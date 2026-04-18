const { fetchJson, postJson } = require("../core/http");

async function checkRest(address, url) {
  const data = await fetchJson(`${url}${address}`);
  if (!data) return null;

  if (data.chain_stats) return (data.chain_stats.tx_count || 0) > 0;
  if (Array.isArray(data.txs)) return data.txs.length > 0;
  if (typeof data.tx_count === "number") return data.tx_count > 0;

  return false;
}

async function checkRpc(address, url) {
  const data = await postJson(url, {
    jsonrpc: "1.0",
    id: "scan",
    method: "getreceivedbyaddress",
    params: [address]
  });

  if (!data) return null;
  return typeof data.result === "number" ? data.result > 0 : false;
}

class BTCChecker {
  constructor(rpcManager) {
    this.rpcManager = rpcManager;
  }

  async check(address) {
    for (let i = 0; i < this.rpcManager.rpcs.length; i += 1) {
      const entry = this.rpcManager.get();
      if (!entry) return false;

      const result = entry.mode.toUpperCase() === "REST"
        ? await checkRest(address, entry.url)
        : await checkRpc(address, entry.url);

      if (result === null) {
        this.rpcManager.markFail(entry);
        continue;
      }

      this.rpcManager.markSuccess(entry);
      if (result === true) return true;
    }

    return false;
  }
}

module.exports = { BTCChecker };
