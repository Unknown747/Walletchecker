const fs = require("fs");
const path = require("path");
const { batchSize } = require("./config");
const { RPCManager } = require("./rpcManager");

class Engine {
  constructor(CheckerClass, rpcFile, inputFile, activeFile, chain, walletMap = new Map()) {
    this.CheckerClass = CheckerClass;
    this.rpcFile = rpcFile;
    this.inputFile = inputFile;
    this.activeFile = activeFile;
    this.chain = chain;
    this.walletMap = walletMap;

    this.addresses = this.loadAddresses();
    this.processed = 0;
    this.active = 0;
    this.inactive = 0;
    this.retries = 0;
    this.retryQueue = [];

    this.rpcManager = this.buildRpcManager();
    this.checker = new CheckerClass(this.rpcManager);
  }

  loadAddresses() {
    try {
      return fs
        .readFileSync(this.inputFile, "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  buildRpcManager() {
    const entries = [];

    try {
      const lines = fs.readFileSync(this.rpcFile, "utf8").split(/\r?\n/);

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line.includes("|")) {
          const [a, b] = line.split("|", 2).map((s) => s.trim());
          entries.push(
            a.startsWith("http") ? { mode: b, url: a } : { mode: a, url: b }
          );
        } else {
          entries.push({ mode: "RPC", url: line });
        }
      }
    } catch {
      return new RPCManager([]);
    }

    return new RPCManager(entries);
  }

  saveActiveKey(address) {
    const walletData = this.walletMap.get(address);
    if (!walletData) return;

    const record = JSON.stringify({
      chain: this.chain,
      address,
      foundAt: new Date().toISOString(),
      ...walletData
    });

    const keysFile = path.join(path.dirname(this.activeFile), "active_keys.txt");
    fs.mkdirSync(path.dirname(keysFile), { recursive: true });
    fs.appendFileSync(keysFile, `${record}\n`);
  }

  async worker(address, isRetry = false) {
    try {
      const result = await this.checker.check(address);
      this.processed += 1;

      if (result) {
        this.active += 1;
        fs.mkdirSync(path.dirname(this.activeFile), { recursive: true });
        fs.appendFileSync(this.activeFile, `${this.chain},${address}\n`);
        this.saveActiveKey(address);
      } else {
        this.inactive += 1;
      }
    } catch {
      if (!isRetry) {
        this.retryQueue.push(address);
      } else {
        this.retries += 1;
      }
    }
  }

  async runBatch(addresses, isRetry = false) {
    let tasks = [];

    for (const address of addresses) {
      tasks.push(this.worker(address, isRetry));

      if (tasks.length >= batchSize) {
        await Promise.all(tasks);
        tasks = [];
      }
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }

  async run() {
    await this.runBatch(this.addresses);

    if (this.retryQueue.length > 0) {
      const toRetry = [...this.retryQueue];
      this.retryQueue = [];
      await this.runBatch(toRetry, true);
    }
  }

  reset() {
    this.addresses = this.loadAddresses();
    this.processed = 0;
    this.active = 0;
    this.inactive = 0;
    this.retries = 0;
    this.retryQueue = [];
  }

  status() {
    return {
      chain: this.chain,
      processed: this.processed,
      active: this.active,
      inactive: this.inactive,
      retries: this.retries,
      rpcStatus: this.rpcManager.rpcs.map((_, i) => ({
        state: (this.rpcManager.failCount.get(i) || 0) < require("./config").rpcFailThreshold
          ? "available"
          : "blacklisted"
      }))
    };
  }
}

module.exports = { Engine };
