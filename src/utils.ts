import { Point, randomSelection } from "@tkey-mpc/common-types";
import ThresholdKey from "@tkey-mpc/core";
import { ShareSerializationModule } from "@tkey-mpc/share-serialization";
import BN from "bn.js";
import EC from "elliptic";

import { VALID_SHARE_INDICES as VALID_TSS_INDICES } from "./constants";

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

// TODO think which conversion functions to keep and how to export them.

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
  // TODO this is compatible with the implementation before, but instead would
  // be better to hash to scalar instead?
  const bn = new BN(buf);
  return bn.mod(ec.n);
}

/**
 * Refreshes TSS shares. Allows to change number of shares. New user shares are
 * only produced for the target indices.
 * @param tKey - Tkey instance to use.
 * @param factorPubs - Factor pub keys after refresh.
 * @param tssIndices - Target tss indices to generate new shares for.
 * @param factorKeyForExistingTSSShare - Factor key for existing TSS share.
 * @param signatures - Signatures for authentication against RSS servers.
 */
async function refreshTssShares(
  tKey: ThresholdKey,
  factorPubs: Point[],
  tssIndices: number[],
  factorKeyForExistingTSSShare: BN,
  signatures: string[]
) {
  const { tssShare, tssIndex } = await tKey.getTSSShare(factorKeyForExistingTSSShare);

  const rssNodeDetails = await tKey._getRssNodeDetails();
  const { serverEndpoints, serverPubKeys, serverThreshold } = rssNodeDetails;
  const randomSelectedServers = randomSelection(
    new Array(rssNodeDetails.serverEndpoints.length).fill(null).map((_, i) => i + 1),
    Math.ceil(rssNodeDetails.serverEndpoints.length / 2)
  );

  const verifierNameVerifierId = tKey.serviceProvider.getVerifierNameVerifierId();
  await tKey._refreshTSSShares(true, tssShare, tssIndex, factorPubs, tssIndices, verifierNameVerifierId, {
    selectedServers: randomSelectedServers,
    serverEndpoints,
    serverPubKeys,
    serverThreshold,
    authSignatures: signatures,
  });
}

export async function addFactorAndRefresh(
  tKey: ThresholdKey,
  newFactorPub: Point,
  newFactorTSSIndex: number,
  factorKeyForExistingTSSShare: BN,
  signatures: string[]
) {
  if (!tKey) {
    throw new Error("tkey does not exist, cannot add factor pub");
  }
  if (VALID_TSS_INDICES.indexOf(newFactorTSSIndex) === -1) {
    throw new Error(`invalid new share index: must be one of ${VALID_TSS_INDICES}`);
  }
  if (!tKey.metadata.factorPubs || !Array.isArray(tKey.metadata.factorPubs[tKey.tssTag])) {
    throw new Error(`factorPubs for tssTag = "${tKey.tssTag}" does not exist`);
  }

  const existingFactorPubs = tKey.metadata.factorPubs[tKey.tssTag];
  const updatedFactorPubs = existingFactorPubs.concat([newFactorPub]);

  const existingTSSIndexes = existingFactorPubs.map((fb) => tKey.getFactorEncs(fb).tssIndex);
  const updatedTSSIndexes = existingTSSIndexes.concat([newFactorTSSIndex]);

  await refreshTssShares(tKey, updatedFactorPubs, updatedTSSIndexes, factorKeyForExistingTSSShare, signatures);
}

export async function deleteFactorAndRefresh(tKey: ThresholdKey, factorPubToDelete: Point, factorKeyForExistingTSSShare: BN, signatures: string[]) {
  if (!tKey) {
    throw new Error("tkey does not exist, cannot add factor pub");
  }
  if (!tKey.metadata.factorPubs || !Array.isArray(tKey.metadata.factorPubs[tKey.tssTag])) {
    throw new Error(`factorPubs for tssTag = "${tKey.tssTag}" does not exist`);
  }

  const existingFactorPubs = tKey.metadata.factorPubs[tKey.tssTag];
  const factorIndex = existingFactorPubs.findIndex((p) => p.x.eq(factorPubToDelete.x));
  if (factorIndex === -1) {
    throw new Error(`factorPub ${factorPubToDelete} does not exist`);
  }

  const updatedFactorPubs = existingFactorPubs.slice();
  updatedFactorPubs.splice(factorIndex, 1);
  const updatedTSSIndexes = updatedFactorPubs.map((fb) => tKey.getFactorEncs(fb).tssIndex);

  await refreshTssShares(tKey, updatedFactorPubs, updatedTSSIndexes, factorKeyForExistingTSSShare, signatures);
}
