import { Point, randomSelection } from "@tkey-mpc/common-types";
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

export async function addNewTSSShareAndFactor(
  tKey: ThresholdKey,
  newFactorPub: Point,
  newFactorTSSIndex: number,
  factorKeyForExistingTSSShare: BN,
  signatures: string[]
) {
  // if (!tKey) {
  //   throw new Error("tkey does not exist, cannot add factor pub");
  // }
  // if (!(newFactorTSSIndex === 2 || newFactorTSSIndex === 3)) {
  //   newFactorTSSIndex = 3;
  //   // throw new Error("tssIndex must be 2 or 3");
  // }
  // if (!tKey.metadata.factorPubs || !Array.isArray(tKey.metadata.factorPubs[tKey.tssTag])) {
  //   throw new Error("factorPubs does not exist");
  // }

  const existingFactorPubs = tKey.metadata.factorPubs[tKey.tssTag];
  const updatedFactorPubs = existingFactorPubs.concat([newFactorPub]);
  const existingTSSIndexes = existingFactorPubs.map((fb) => tKey.getFactorEncs(fb).tssIndex);
  const updatedTSSIndexes = existingTSSIndexes.concat([newFactorTSSIndex]);
  const { tssShare, tssIndex } = await tKey.getTSSShare(factorKeyForExistingTSSShare);

  // TODO the only difference to the current version of tKey's
  // `generateNewShare` is that here we only update factorPubs, while in tkey
  // they also update tssNonce, tssPolyCommits, and factorEncs, and this seems
  // to cause issues.
  tKey.metadata.addTSSData({
    tssTag: tKey.tssTag,
    factorPubs: updatedFactorPubs,
  });

  const rssNodeDetails = await tKey._getRssNodeDetails();
  const { serverEndpoints, serverPubKeys, serverThreshold } = rssNodeDetails;
  const randomSelectedServers = randomSelection(
    new Array(rssNodeDetails.serverEndpoints.length).fill(null).map((_, i) => i + 1),
    Math.ceil(rssNodeDetails.serverEndpoints.length / 2)
  );

  const verifierNameVerifierId = tKey.serviceProvider.getVerifierNameVerifierId();
  await tKey._refreshTSSShares(true, tssShare, tssIndex, updatedFactorPubs, updatedTSSIndexes, verifierNameVerifierId, {
    selectedServers: randomSelectedServers,
    serverEndpoints,
    serverPubKeys,
    serverThreshold,
    authSignatures: signatures,
  });
}
