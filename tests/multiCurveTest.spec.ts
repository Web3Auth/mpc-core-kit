import { COREKIT_STATUS } from '../src/interfaces';
import dklslib from "@toruslabs/tss-dkls-lib";
import frostLib from "@toruslabs/tss-frost-lib";
import frostBip340lib from "@toruslabs/tss-frost-lib-bip340";

import { expect } from "chai";
import { describe, it } from "node:test";
import { makeBip340Signer, makeEd25519Signer, makeEthereumSigner, MemoryStorage, sigToRSV, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit } from "src";
import {  mockLogin2 } from "./setup";
import { KeyType } from '@tkey/common-types';
import { BN } from 'bn.js';
import { MockStorageLayer  } from '@tkey/storage-layer-torus';
import { secp256k1 } from '@noble/curves/secp256k1';
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, utf8ToBytes, bytesToNumberBE } from '@noble/curves/abstract/utils';
import { keccak_256 } from '@noble/hashes/sha3';

import { schnorr as bip340 } from '@noble/curves/secp256k1';


const web3AuthNetwork = WEB3AUTH_NETWORK.DEVNET;
const manualSync = false;
const verifierId = "multicurvetest"

const mockSL = new MockStorageLayer({
    dataMap: {},
    lockMap: {},
});

describe("multiCurveTest", () => {
    const newCoreKitInstance = () =>
        new Web3AuthMPCCoreKit({
          web3AuthClientId: "torus-key-test",
          web3AuthNetwork,
          baseUrl: "http://localhost:3000",
          uxMode: "nodejs",
          supportedKeyTypes: [KeyType.secp256k1, KeyType.ed25519],
          storage: new MemoryStorage(),
          manualSync,
        });
    
    
    const testAllSigning = async (instance: Web3AuthMPCCoreKit) => {
        const message = "message to sign";

        const hash = keccak_256(message);
        instance.addTssLibs([dklslib]);
        const result = await instance.sign_ECDSA_secp256k1(Buffer.from(hash), {hashed: true})
        const {r, s } = sigToRSV(result);

        const validsecp256k1 = secp256k1.verify({
            r: bytesToNumberBE(r),
            s: bytesToNumberBE(s),
        }, bytesToHex(hash), bytesToHex(instance.getPubKey(KeyType.secp256k1,  false)))
        expect(validsecp256k1).eq(true);

        instance.addTssLibs([frostBip340lib]);
        const result2 = await instance.signBIP340( Buffer.from(utf8ToBytes(message)), {hashed: false})
        
        const validb340 = bip340.verify(bytesToHex(result2), bytesToHex(utf8ToBytes(message)), bytesToHex(instance.getPubKeyBip340()));
        expect(validb340).eq(true);


        instance.addTssLibs([frostLib]);
        const result3 = await instance.signED25519(Buffer.from(message))
        const valided25519 = ed25519.verify(bytesToHex(result3), bytesToHex(Buffer.from(message)), bytesToHex( new Uint8Array(instance.getPubKeyEd25519()) ) )
        expect(valided25519).eq(true);


        const ethSigner = makeEthereumSigner(instance)
        const ethSignerPubKey = await ethSigner.getPublic();
        const ethSignerResult = await ethSigner.sign(Buffer.from(hash)) 
        const validsethSignerResult = secp256k1.verify({
            r: bytesToNumberBE(ethSignerResult.r),
            s: bytesToNumberBE(ethSignerResult.s),
        }, bytesToHex(hash), "04"+bytesToHex(ethSignerPubKey));
        expect(validsethSignerResult).eq(true);  


        const bip340Signer = makeBip340Signer(instance)
        const bip340SignerResult = await bip340Signer.sign(Buffer.from(utf8ToBytes(message)));


        const validBip340SignerResult = bip340.verify(bip340SignerResult, bytesToHex(utf8ToBytes(message)), bytesToHex(instance.getPubKeyBip340()));
        expect(validBip340SignerResult).eq(true);
              
        const ed25519Signer = makeEd25519Signer(instance)
        const ed25519SignerResult = await ed25519Signer.sign(Buffer.from(utf8ToBytes(message)))
        const validEd25519SignerResult = ed25519.verify(ed25519SignerResult, bytesToHex(Buffer.from(message)), bytesToHex( new Uint8Array(instance.getPubKeyEd25519()) ) )
        expect(validEd25519SignerResult).eq(true);  

    }

    it("should able to initialize with multiple curve/ tsslib", async () => {
        const instance = newCoreKitInstance();
        await instance.init({ handleRedirectResult: false, rehydrate: false });
        
        // mock storage layer
        instance.tKey.storageLayer = mockSL;


        const { idToken, parsedToken } = await mockLogin2(verifierId);
        
        await instance.loginWithJWT({
            verifier: "torus-test-health",
            verifierId: parsedToken.email,
            idToken,
        });

        expect(instance.status).eq("LOGGED_IN");

        
        await testAllSigning(instance);


        const recoverFactor = await instance.enableMFA({})

        await testAllSigning(instance);
        

        const instance2 = newCoreKitInstance();
        await instance2.init({ handleRedirectResult: false, rehydrate: false });

        // mock storage layer
        instance2.tKey.storageLayer = mockSL;
        
        const { idToken: idToken2, parsedToken: parsedToken2 } = await mockLogin2(verifierId);
        await instance2.loginWithJWT({
            verifier: "torus-test-health",
            verifierId: parsedToken2.email,
            idToken: idToken2,
        });

        expect(instance2.status).eq(COREKIT_STATUS.REQUIRED_SHARE);

        await instance2.inputFactorKey(new BN(recoverFactor, "hex"));
        expect(instance2.status).eq(COREKIT_STATUS.LOGGED_IN);

        await testAllSigning(instance2);

    })

});