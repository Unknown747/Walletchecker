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
    if (this.rpcs.length === 0) {
      return null;
    }

    const entry = this.rpcs[this.index % this.rpcs.length];
    this.index += 1;
    return entry;
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
}

module.exports = { RPCManager };