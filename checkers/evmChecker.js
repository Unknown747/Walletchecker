const { postJson } = require("../core/http");

class EVMChecker {
  constructor(rpcManager) {
    this.rpcManager = rpcManager;
  }

  async check(address) {
    for (let i = 0; i < this.rpcManager.rpcs.length; i += 1) {
      const entry = this.rpcManager.get();
      if (!entry) return false;

      const data = await postJson(entry.url, {
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1
      });

      if (!data?.result) {
        this.rpcManager.markFail(entry);
        continue;
      }

      this.rpcManager.markSuccess(entry);
      return BigInt(data.result) > 0n;
    }

    return false;
  }
}

module.exports = { EVMChecker };
