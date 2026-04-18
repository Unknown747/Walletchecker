async function postJson(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

class EVMChecker {
  constructor(rpcManager) {
    this.rpcManager = rpcManager;
  }

  async check(address) {
    for (let i = 0; i < this.rpcManager.rpcs.length; i += 1) {
      const entry = this.rpcManager.get();
      if (!entry) {
        return false;
      }

      try {
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
      } catch {
        this.rpcManager.markFail(entry);
      }
    }

    return false;
  }
}

module.exports = { EVMChecker };