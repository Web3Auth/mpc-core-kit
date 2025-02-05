export interface ISessionSigGenerator {
  getSessionSigs: () => Promise<string[]>;
}
