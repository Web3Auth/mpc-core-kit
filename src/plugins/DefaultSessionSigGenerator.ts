import { IMPCContext } from "../interfaces";
import { ISessionSigGenerator } from "./ISessionSigGenerator";

export class DefaultSessionSigGeneratorPlugin implements ISessionSigGenerator {
  private context: IMPCContext;

  constructor(readonly mpcCorekitContext: IMPCContext) {
    this.context = mpcCorekitContext;
  }

  async getSessionSigs() {
    return this.context.state.signatures || [];
  }
}
