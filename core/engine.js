const fs = require("fs");
const path = require("path");
const { RPCManager } = require("./rpcManager");

class Engine {
  constructor(CheckerClass, rpcFile, inputFile, activeFile, inactiveFile, chain) {
    this.CheckerClass = CheckerClass;
    this.rpcFile = rpcFile;
    this.inputFile = inputFile;
    this.activeFile = activeFile;
    this.inactiveFile = inactiveFile;
    this.chain = chain;

    this.addresses = this.loadAddresses();
    this.processed = 0;
    this.active = 0;
    this.inactive = 0;
    this.retries = 0;

    this.rpcManager = this.buildRpcManager();
    this.checker = new CheckerClass(this.rpcManager);
  }

  loadAddresses() {
    try {
      return fs
        .readFileSync(this.inputFile, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
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
        if (!line) {
          continue;
        }

        if (line.includes("|")) {
          const [leftRaw, rightRaw] = line.split("|", 2);
          const left = leftRaw.trim();
          const right = rightRaw.trim();

          if (left.startsWith("http://") || left.startsWith("https://")) {
            entries.push({ mode: right, url: left });
          } else {
            entries.push({ mode: left, url: right });
          }
        } else {
          entries.push({ mode: "RPC", url: line });
        }
      }
    } catch {
      return new RPCManager([]);
    }

    return new RPCManager(entries);
  }

  async worker(address) {
    try {
      const result = await this.checker.check(address);
      this.processed += 1;

      if (result) {
        this.active += 1;
        fs.mkdirSync(path.dirname(this.activeFile), { recursive: true });
        fs.appendFileSync(this.activeFile, `${this.chain},${address}\n`);
      } else {
        this.inactive += 1;
      }
    } catch {
      this.retries += 1;
    }
  }

  async run() {
    let tasks = [];

    for (const address of this.addresses) {
      tasks.push(this.worker(address));

      if (tasks.length >= 100) {
        await Promise.all(tasks);
        tasks = [];
      }
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }

  reset() {
    this.addresses = this.loadAddresses();
    this.processed = 0;
    this.active = 0;
    this.inactive = 0;
    this.retries = 0;
  }

  status() {
    return {
      chain: this.chain,
      processed: this.processed,
      active: this.active,
      inactive: this.inactive,
      retries: this.retries,
      rpcStatus: this.rpcManager.rpcs.map((entry, index) => ({
        url: entry.url,
        state: (this.rpcManager.failCount.get(index) || 0) === 0 ? "available" : "retrying"
      }))
    };
  }
}

module.exports = { Engine };