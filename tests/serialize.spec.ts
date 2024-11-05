import { describe, it } from "node:test";
import { defaultTestOptions, newCoreKitLogInInstance } from "./setup";
import { AsyncStorage, MemoryStorage, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit } from "src";
import { deepEqual, deepStrictEqual, equal, strictEqual } from "node:assert";


describe('serialize deserialze mpc corekit', () => {
    it('serialize', async () => {
        const localMemoryStorage = new MemoryStorage();
        const instance = await newCoreKitLogInInstance({
            network: WEB3AUTH_NETWORK.DEVNET,
            manualSync: true,
            email: "a@b.com",
            storageInstance:  localMemoryStorage,
        })
        const options = defaultTestOptions({ network: WEB3AUTH_NETWORK.DEVNET, manualSync: true, storageInstance: localMemoryStorage });
        const serialized = JSON.stringify(instance);
        console.log(serialized)
        const deserialized = await Web3AuthMPCCoreKit.fromJSON(JSON.parse(serialized), options);

        

    }); 
});
