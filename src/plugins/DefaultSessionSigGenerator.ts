import { IContext } from "../interfaces";
import { ISessionSigGenerator } from "./ISessionSigGenerator";

export class DefaultSessionSigGeneratorPlugin implements ISessionSigGenerator {
  private context: IContext;

  constructor(readonly mpcCorekitContext: IContext) {
    this.context = mpcCorekitContext;
  }

  async getSessionSigs() {
    return this.context.state.signatures || [];
  }
}
