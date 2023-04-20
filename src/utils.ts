export const generateTSSEndpoints = (tssNodeEndpoints: string[], parties: number, clientIndex: number) => {
  const endpoints: string[] = [];
  const tssWSEndpoints: string[] = [];
  const partyIndexes: number[] = [];
  for (let i = 0; i < parties; i++) {
    partyIndexes.push(i);
    if (i === clientIndex) {
      endpoints.push(null as any);
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
