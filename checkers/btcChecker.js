async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

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

async function checkRest(address, url) {
  const data = await fetchJson(`${url}${address}`);
  if (!data) {
    return null;
  }

  if (data.chain_stats) {
    return (data.chain_stats.tx_count || 0) > 0;
  }

  if (Array.isArray(data.txs)) {
    return data.txs.length > 0;
  }

  if (typeof data.tx_count === "number") {
    return data.tx_count > 0;
  }

  return false;
}

async function checkRpc(address, url) {
  const data = await postJson(url, {
    jsonrpc: "1.0",
    id: "scan",
    method: "getreceivedbyaddress",
    params: [address]
  });

  if (!data) {
    return null;
  }

  if (typeof data.result === "number") {
    return data.result > 0;
  }

  return false;
}

class BTCChecker {
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
        const result = entry.mode.toUpperCase() === "REST"
          ? await checkRest(address, entry.url)
          : await checkRpc(address, entry.url);

        if (result === true) {
          this.rpcManager.markSuccess(entry);
          return true;
        }

        if (result === null) {
          this.rpcManager.markFail(entry);
        } else {
          this.rpcManager.markSuccess(entry);
        }
      } catch {
        this.rpcManager.markFail(entry);
      }
    }

    return false;
  }
}

module.exports = { BTCChecker };