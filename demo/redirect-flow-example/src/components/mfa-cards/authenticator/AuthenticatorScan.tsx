import * as React from "react";
import { Button } from "../../Button";
import { Card } from "../../Card";
import crypto from "crypto";
import base32 from "hi-base32";
import { useCoreKit } from "../../../composibles/useCoreKit";
import url from "url";
import QRCode from "react-qr-code";
import { COREKIT_STATUS, FactorKeyTypeShareDescription, generateFactorKey, TssShareType } from "@web3auth/mpc-core-kit";
import axios from "axios";
import BN from "bn.js";
import { Point } from "@tkey/common-types";
import { TextField } from "../../TextField";
import { getEcCrypto } from "../../../App";
import { keccak256 } from "ethereum-cryptography/keccak";

const AuthenticatorQRCodeCard: React.FC = () => {
  const { coreKitInstance, setDrawerHeading, setDrawerInfo } = useCoreKit();
  const [imageUrl, setImageUrl] = React.useState("");
  const [currentStep, setCurrentStep] = React.useState("register");
  const [secretKey, setSecretKey] = React.useState<string>("");
  const authenticatorVerifierUrl = "https://authenticator.web3auth.com";
  const [factorKey, setFactorKey] = React.useState<{ private: BN; pub: Point } | null>(null);
  const [code, setCode] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const otpauthURL = (options: any) => {
    // unpack options
    let secret = options.secret;
    const label = options.label;
    const issuer = options.issuer;
    const type = (options.type || "totp").toLowerCase();
    const counter = options.counter;
    const algorithm = (options.algorithm || "sha1").toLowerCase();
    const digits = options.digits || 6;
    let period = options.period || 30;
    // not so sure about this
    const encoding = options.encoding || "ascii";

    // validate type
    switch (type) {
      case "totp":
      case "hotp":
        break;
      default:
        throw new Error("otpauthURL - Invalid type `" + type + "`; must be `hotp` or `totp`");
    }

    // validate required options
    if (!secret) throw new Error("otpauthURL - Missing secret");
    if (!label) throw new Error("otpauthURL - Missing label");

    // require counter for HOTP
    if (type === "hotp" && (counter === null || typeof counter === "undefined")) {
      throw new Error("otpauthURL - Missing counter value for HOTP");
    }

    // convert secret to base32
    if (encoding !== "base32") secret = new Buffer(secret, encoding);
    if (Buffer.isBuffer(secret)) secret = base32.encode(secret);

    // build query while validating
    const query: any = { secret: secret };
    if (issuer) query.issuer = issuer;
    if (type === "hotp") {
      query.counter = counter;
    }

    // validate algorithm
    if (algorithm !== null) {
      switch (algorithm.toUpperCase()) {
        case "SHA1":
        case "SHA256":
        case "SHA512":
          break;
        default:
          console.warn("otpauthURL - Warning - Algorithm generally should be SHA1, SHA256, or SHA512");
      }
      query.algorithm = algorithm.toUpperCase();
    }

    // validate digits
    if (digits !== null) {
      if (isNaN(digits)) {
        throw new Error("otpauthURL - Invalid digits `" + digits + "`");
      } else {
        switch (parseInt(digits, 10)) {
          case 6:
          case 8:
            break;
          default:
            console.warn("otpauthURL - Warning - Digits generally should be either 6 or 8");
        }
      }
      query.digits = digits;
    }

    // validate period
    if (period !== null) {
      period = parseInt(period, 10);
      if (~~period !== period) {
        throw new Error("otpauthURL - Invalid period `" + period + "`");
      }
      query.period = period;
    }

    // return url
    return url.format({
      protocol: "otpauth",
      slashes: true,
      hostname: type,
      pathname: encodeURIComponent(label),
      query: query,
    });
  };

  const generateSecretASCII = function generateSecretASCII() {
    const bytes = crypto.randomBytes(20);
    return base32.encode(bytes).toString().replace(/=/g, "");
  };

  const generateSecretKey = async () => {
    const key = generateSecretASCII();
    const userInfo = coreKitInstance.getUserInfo();
    const totpURL = otpauthURL({
      secret: key,
      label: userInfo?.verifierId,
      issuer: "MPC Core kit",
      encoding: "base32",
    });
    return { url, key, totpURL };
  };

  React.useEffect(() => {
    const init = async () => {
      const { totpURL, key } = await generateSecretKey();
      const factorKey = generateFactorKey();
      setFactorKey(factorKey);
      setImageUrl(totpURL);
      setSecretKey(key);
    };
    init();
  }, []);

  const verifyNewAuthenticator = async () => {
    setIsLoading(true);
    try {
      if (!code) {
        return;
      }
      const authenticatorFactorMetadataToSet = {
        factorKey: factorKey?.private.toString("hex"),
      };
      const pubKey = getEcCrypto().keyFromPublic(coreKitInstance.getPubKey()).getPublic();

      const { data } = await axios.post<{ data: { id: string } }>(`${authenticatorVerifierUrl}/api/v1/verify`, {
        address: `${pubKey?.getX().toString("hex") ?? ""}${pubKey?.getY()?.toString("hex") ?? ""}`,
        code,
        data: authenticatorFactorMetadataToSet,
      });
      console.log(data);
      await creatAuthFactor();
      setDrawerHeading("Authenticator");
      setDrawerInfo("Authenticator has been set successfully");
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const registerNewAuthenticator = async () => {
    setIsLoading(true);
    try {
      const precomputedTssClient = await coreKitInstance.precompute_secp256k1();
      const sig = await coreKitInstance.sign(Buffer.from(keccak256(Buffer.from(secretKey, "utf-8"))), true, precomputedTssClient);
      const pubKey = getEcCrypto().keyFromPublic(coreKitInstance.getPubKey()).getPublic();
      // Extract r, s, and v from the signature buffer
      const sigUint8Array = new Uint8Array(sig);

      // Extract r, s, and v from the signature buffer
      const r = Buffer.from(sigUint8Array.slice(0, 32)).toString("hex");
      const s = Buffer.from(sigUint8Array.slice(32, 64)).toString("hex");
      const v = sigUint8Array[64];

      const { data } = await axios.post<{ data: { id: string } }>(`${authenticatorVerifierUrl}/api/v1/register`, {
        pubKey: {
          x: pubKey.getX().toString("hex"),
          y: pubKey.getY().toString("hex"),
        },
        secretKey,
        sig: {
          r: r,
          s: s,
          v: v.toString(16), // Convert v to hex string
        },
      });
      setCurrentStep("verify");
      return data;
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  const creatAuthFactor = async (): Promise<void> => {
    if (!coreKitInstance || !secretKey) {
      throw new Error("required fields are not set");
    }

    if (coreKitInstance.getTssFactorPub().length === 1) {
      await coreKitInstance.enableMFA({
        factorKey: factorKey?.private,
        additionalMetadata: { shareType: TssShareType.RECOVERY.toString() },
        shareDescription: FactorKeyTypeShareDescription.Other,
      });
    } else {
      await coreKitInstance.createFactor({
        shareType: TssShareType.DEVICE,
        factorKey: factorKey?.private,
      });
    }

    if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
      await coreKitInstance.commitChanges();
    }
    // await inputBackupFactorKey(mnemonic);
  };

  return (
    <>
      {currentStep === "register" ? (
        <Card className="px-8 py-6 w-full !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
          <div className="text-center">
            <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-4">Authenticator QR Code</h3>
            {imageUrl ? (
              <QRCode size={256} style={{ height: "auto", maxWidth: "100%", width: "100%" }} value={imageUrl} viewBox={`0 0 256 256`} />
            ) : (
              <img src={"https://via.placeholder.com/150"} alt="QR Code" className="mx-auto mb-4" />
            )}
            <Button loading={isLoading} className="w-full mt-3" variant="primary" onClick={registerNewAuthenticator}>
              Proceed
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="px-8 py-6 w-full !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
          <div className="text-center">
            <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-4">Verify Authenticator Code</h3>
            <TextField value={code} onChange={(e) => setCode(e.target.value)} label="6 Digit Code" placeholder="Enter code" className="mb-4" />
            <Button loading={isLoading} className="w-full" variant="primary" onClick={verifyNewAuthenticator}>
              Verify
            </Button>
          </div>
        </Card>
      )}
    </>
  );
};

export { AuthenticatorQRCodeCard };
