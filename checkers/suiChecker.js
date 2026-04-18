const { postJson } = require("../core/http");

class SUIChecker {
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
        method: "suix_getBalance",
        params: [address]
      });

      if (!data?.result) {
        this.rpcManager.markFail(entry);
        continue;
      }

      this.rpcManager.markSuccess(entry);
      return BigInt(data.result.totalBalance || "0") > 0n;
    }

    return false;
  }
}

module.exports = { SUIChecker };
