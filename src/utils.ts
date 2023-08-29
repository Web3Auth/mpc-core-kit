import ThresholdKey from "@tkey-mpc/core";
import { ShareSerializationModule } from "@tkey-mpc/share-serialization";
import BN from "bn.js";
import EC from "elliptic";

export const generateTSSEndpoints = (tssNodeEndpoints: string[], parties: number, clientIndex: number) => {
  const endpoints: string[] = [];
  const tssWSEndpoints: string[] = [];
  const partyIndexes: number[] = [];
  for (let i = 0; i < parties; i++) {
    partyIndexes.push(i);
    if (i === clientIndex) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      endpoints.push(null as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tssWSEndpoints.push(null as any);
    } else {
      endpoints.push(tssNodeEndpoints[i]);
      tssWSEndpoints.push(new URL(tssNodeEndpoints[i]).origin);
    }
  }
  return { endpoints, tssWSEndpoints, partyIndexes };
};

export function storageAvailable(type: string): boolean {
  let storageExists = false;
  let storageLength = 0;
  let storage: Storage;
  try {
    storage = window[type];
    storageExists = true;
    storageLength = storage.length;
    const x = "__storage_test__";
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (error) {
    return (
      error &&
      // everything except Firefox
      (error.code === 22 ||
        // Firefox
        error.code === 1014 ||
        // test name field too, because code might not be present
        // everything except Firefox
        error.name === "QuotaExceededError" ||
        // Firefox
        error.name === "NS_ERROR_DOM_QUOTA_REACHED") &&
      // acknowledge QuotaExceededError only if there's something already stored
      storageExists &&
      storageLength !== 0
    );
  }
}

/**
 * Converts a mnemonic to a factor key.
 * @param tKey - An initialized tKey instance.
 * @param shareMnemonic - The mnemonic to convert.
 * @returns The factor key.
 */
export async function mnemonicToKey(tKey: ThresholdKey, shareMnemonic: string): Promise<BN> {
  const factorKey = await (tKey.modules.shareSerialization as ShareSerializationModule).deserialize(shareMnemonic, "mnemonic");
  return factorKey;
}

/**
 * Converts an arbitrary string to a factor key over an elliptic curve.
 * @param ec - The elliptic curve.
 * @param shareMnemonic - The mnemonic to convert.
 * @returns The factor key.
 */
export async function stringToKey(ec: EC.curve.base, s: string): Promise<BN> {
  const buf = Buffer.from(s);
  const bn = new BN(buf);
  return bn.mod(ec.n);
}
