const { rpcFailThreshold } = require("./config");

class RPCManager {
  constructor(rpcEntries) {
    this.rpcs = rpcEntries;
    this.index = 0;
    this.failCount = new Map();

    for (let i = 0; i < rpcEntries.length; i += 1) {
      this.failCount.set(i, 0);
    }
  }

  get() {
    if (this.rpcs.length === 0) return null;

    const total = this.rpcs.length;

    for (let attempt = 0; attempt < total; attempt += 1) {
      const idx = this.index % total;
      this.index += 1;

      if ((this.failCount.get(idx) || 0) < rpcFailThreshold) {
        return this.rpcs[idx];
      }
    }

    return null;
  }

  markFail(entry) {
    const index = this.rpcs.indexOf(entry);
    if (index >= 0) {
      this.failCount.set(index, (this.failCount.get(index) || 0) + 1);
    }
  }

  markSuccess(entry) {
    const index = this.rpcs.indexOf(entry);
    if (index >= 0) {
      this.failCount.set(index, 0);
    }
  }

  availableCount() {
    return this.rpcs.filter((_, i) => (this.failCount.get(i) || 0) < rpcFailThreshold).length;
  }
}

module.exports = { RPCManager };
