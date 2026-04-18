const { postJson } = require("../core/http");

class SolChecker {
  constructor(rpcManager) {
    this.rpcManager = rpcManager;
  }

  async check(address) {
    for (let i = 0; i < this.rpcManager.rpcs.length; i += 1) {
      const entry = this.rpcManager.get();
      if (!entry) return false;

      const data = await postJson(entry.url, {
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address]
      });

      if (typeof data?.result?.value !== "number") {
        this.rpcManager.markFail(entry);
        continue;
      }

      this.rpcManager.markSuccess(entry);
      return data.result.value > 0;
    }

    return false;
  }
}

module.exports = { SolChecker };
