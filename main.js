const { Engine } = require("./core/engine");
const { EVMChecker } = require("./checkers/evmChecker");
const { BTCChecker } = require("./checkers/btcChecker");
const { SolChecker } = require("./checkers/solChecker");
const { SUIChecker } = require("./checkers/suiChecker");
const { generateWallets, parseCount } = require("./generateWallets");

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  cyan:   "\x1b[36m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  white:  "\x1b[37m",
  gray:   "\x1b[90m",
  bgGreen: "\x1b[42m",
  bCyan:  "\x1b[1m\x1b[36m",
  bGreen: "\x1b[1m\x1b[32m",
  bYellow:"\x1b[1m\x1b[33m",
  bWhite: "\x1b[1m\x1b[37m",
};

const W = 66; // total display width (inside borders)

function c(color, text) { return `${color}${text}${C.reset}`; }
function pad(text, len, right = false) {
  const str = String(text);
  return right ? str.padStart(len) : str.padEnd(len);
}

function line(content = "") {
  return `${C.gray}│${C.reset} ${content} ${C.gray}│${C.reset}`;
}
function divider(left = "├", mid = "─", right = "┤") {
  return `${C.gray}${left}${mid.repeat(W)}${right}${C.reset}`;
}
function top()    { return divider("╔", "═", "╗"); }
function bottom() { return divider("╚", "═", "╝"); }
function row(left, right, split = "╪") {
  return divider("╠", "═", "╣");
}

function header(title) {
  const inner = c(C.bCyan, title);
  const visLen = title.length;
  const pad1 = Math.floor((W - visLen) / 2) - 1;
  const pad2 = W - visLen - pad1 - 2;
  return `${C.gray}║${C.reset}${" ".repeat(pad1 < 0 ? 0 : pad1)} ${inner} ${" ".repeat(pad2 < 0 ? 0 : pad2)}${C.gray}║${C.reset}`;
}

function row2(label, val1, label2, val2) {
  const left  = `${c(C.gray, label.padEnd(10))}${val1}`;
  const right = `${c(C.gray, label2.padEnd(10))}${val2}`;
  const leftVis  = label.length + 10 + stripAnsi(val1).length;
  const rightVis = label2.length + 10 + stripAnsi(val2).length;
  const gap = W - leftVis - rightVis - 2;
  return line(`${left}${" ".repeat(Math.max(gap, 2))}${right}`);
}

function stripAnsi(str) {
  return String(str).replace(/\x1b\[[0-9;]*m/g, "");
}

function fillLine(content) {
  const vis = stripAnsi(content);
  const pad = W - vis.length - 2;
  return line(`${content}${" ".repeat(Math.max(pad, 0))}`);
}

function progressBar(done, total, width = 36) {
  const pct  = total > 0 ? Math.min(done / total, 1) : 0;
  const fill = Math.round(pct * width);
  const empty = width - fill;
  const bar = c(C.green, "█".repeat(fill)) + c(C.gray, "░".repeat(empty));
  const pctStr = c(C.bWhite, `${Math.round(pct * 100)}%`);
  return `${bar} ${pctStr}`;
}

function elapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

function rpcBar(available, total) {
  const pct = total > 0 ? available / total : 0;
  const color = pct === 1 ? C.green : pct >= 0.5 ? C.yellow : C.red;
  return `${c(color, `${available}/${total}`)}`;
}

function tableRow(chain, checked, active, inactive, rpcAvail, rpcTotal) {
  const chainStr   = c(active > 0 ? C.bGreen : C.white, pad(chain, 9));
  const checkedStr = c(C.white,  pad(checked,  7, true));
  const activeStr  = c(active > 0 ? C.bGreen : C.gray, pad(active, 7, true));
  const inactStr   = c(C.dim,    pad(inactive, 9, true));
  const rpcStr     = rpcBar(rpcAvail, rpcTotal);
  const rpcVis     = `${rpcAvail}/${rpcTotal}`;

  const content = `${chainStr} ${checkedStr} ${activeStr} ${inactStr}  ${rpcStr}`;
  const vis = 9 + 1 + 7 + 1 + 7 + 1 + 9 + 2 + rpcVis.length;
  const pad2 = W - vis - 2;
  return line(`${content}${" ".repeat(Math.max(pad2, 0))}`);
}

// ── Utils ────────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMaps(wallets) {
  const evmMap = new Map();
  const btcMap = new Map();
  const solMap = new Map();
  const suiMap = new Map();

  for (const w of wallets) {
    const keyData = {
      mnemonic:       w.mnemonic,
      evm:            w.evm,
      btc:            w.btc,
      sol:            w.sol,
      sui:            w.sui,
      evmPrivateKey:  w.evmPrivateKey,
      btcPrivateKeyWif: w.btcPrivateKeyWif,
      solSecretKey:   w.solSecretKey,
      suiSecretKey:   w.suiSecretKey
    };
    evmMap.set(w.evm, keyData);
    btcMap.set(w.btc, keyData);
    solMap.set(w.sol, keyData);
    suiMap.set(w.sui, keyData);
  }

  return { evmMap, btcMap, solMap, suiMap };
}

// ── Dashboard ────────────────────────────────────────────────────────────────
async function dashboard(engines, state) {
  const EVM_CHAINS   = ["eth", "bsc", "pol", "base", "arbitrum", "avalanche", "gnosis"];
  const OTHER_CHAINS = ["btc", "sol", "sui"];

  while (true) {
    process.stdout.write("\x1Bc");

    const roundChecked  = engines.reduce((t, e) => t + e.processed, 0);
    const roundActive   = engines.reduce((t, e) => t + e.active,    0);
    const roundInactive = engines.reduce((t, e) => t + e.inactive,  0);
    const roundRetries  = engines.reduce((t, e) => t + e.retries,   0);

    const lifeChecked = state.lifetimeProcessed + roundChecked;
    const lifeActive  = state.lifetimeActive + roundActive;

    const now      = Date.now();
    const totalMs  = now - state.totalStartTime;
    const roundMs  = now - state.roundStartTime;
    const speed    = totalMs > 0 ? ((lifeChecked / (totalMs / 1000)) / engines.length).toFixed(1) : "0.0";
    const dateStr  = new Date().toTimeString().slice(0, 8);

    const statusLabel = state.scanning
      ? c(C.bGreen,  "▶ SCANNING")
      : c(C.bYellow, "⟳ GENERATING");

    // Progress: total addresses per round = count * chains (EVM=1 set, BTC, SOL, SUI)
    const totalPerRound = state.count * engines.length;
    const progress = progressBar(roundChecked, totalPerRound);

    const lines = [];

    lines.push(top());
    lines.push(header("MULTI-CHAIN WALLET SCANNER"));
    lines.push(divider("╠", "═", "╣"));

    // Round / status row
    {
      const left  = `${c(C.gray, "Round  ")} ${c(C.bWhite, `#${state.round}`)}`;
      const mid   = `${c(C.gray, "Status ")} ${statusLabel}`;
      const right = `${c(C.gray, dateStr)}`;
      const vis   = 7 + 1 + String(state.round + 1).length + 2 + 7 + 1 + (state.scanning ? 10 : 12) + 2 + 8;
      const gap1  = Math.floor((W - 2 - stripAnsi(left).length - stripAnsi(mid).length - stripAnsi(right).length) / 2);
      lines.push(line(`${left}${" ".repeat(Math.max(gap1, 2))}${mid}${" ".repeat(Math.max(gap1, 2))}${right}`));
    }

    // Time / speed row
    {
      const left  = `${c(C.gray, "Uptime ")} ${c(C.white, elapsed(totalMs))}`;
      const right = `${c(C.gray, "Round  ")} ${c(C.white, elapsed(roundMs))}   ${c(C.gray, "Speed ")} ${c(C.yellow, `${speed} w/s/chain`)}`;
      const gap   = W - 2 - stripAnsi(left).length - stripAnsi(right).length;
      lines.push(line(`${left}${" ".repeat(Math.max(gap, 2))}${right}`));
    }

    lines.push(divider("╠", "═", "╣"));

    // Stats
    {
      const rl = `${c(C.gray, "Round  ")} ${c(C.bWhite, roundChecked)} checked  ${roundActive > 0 ? c(C.bGreen, `${roundActive} ACTIVE`) : c(C.gray, "0 active")}  ${c(C.dim, `${roundInactive} inactive`)}  ${roundRetries > 0 ? c(C.yellow, `${roundRetries} retries`) : ""}`;
      lines.push(fillLine(rl));
    }
    {
      const ll = `${c(C.gray, "Lifetime")} ${c(C.bWhite, lifeChecked)} checked  ${lifeActive > 0 ? c(C.bGreen, `${lifeActive} ACTIVE FOUND`) : c(C.gray, "0 active found")}`;
      lines.push(fillLine(ll));
    }

    // Progress bar
    {
      const pg = `${c(C.gray, "Progress ")}${progress}`;
      lines.push(fillLine(pg));
    }

    lines.push(divider("╠", "═", "╣"));

    // Table header
    {
      const h = `${c(C.bCyan, pad("Chain", 9))} ${c(C.bCyan, pad("Checked", 7, true))} ${c(C.bCyan, pad("Active", 7, true))} ${c(C.bCyan, pad("Inactive", 9, true))}  ${c(C.bCyan, "RPC")}`;
      lines.push(fillLine(h));
    }
    lines.push(divider("╠", "═", "╣"));

    // EVM rows
    for (const engine of engines) {
      if (!EVM_CHAINS.includes(engine.chain.toLowerCase())) continue;
      const s = engine.status();
      const avail = s.rpcStatus.filter((r) => r.state === "available").length;
      lines.push(tableRow(s.chain, s.processed, s.active, s.inactive, avail, s.rpcStatus.length));
    }

    lines.push(divider("╠", "─", "╣"));

    // Other chain rows
    for (const engine of engines) {
      if (!OTHER_CHAINS.includes(engine.chain.toLowerCase())) continue;
      const s = engine.status();
      const avail = s.rpcStatus.filter((r) => r.state === "available").length;
      lines.push(tableRow(s.chain, s.processed, s.active, s.inactive, avail, s.rpcStatus.length));
    }

    lines.push(divider("╠", "═", "╣"));

    // Footer
    {
      const f = `${c(C.gray, "1 seed → EVM + BTC + SOL + SUI")}   ${c(C.dim, "hits → output/active_keys.txt")}`;
      lines.push(fillLine(f));
    }

    lines.push(bottom());

    console.log(lines.join("\n"));

    await sleep(2000);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const count = parseCount();

  const state = {
    round: 0,
    count,
    scanning: false,
    lifetimeActive: 0,
    lifetimeInactive: 0,
    lifetimeProcessed: 0,
    totalStartTime: Date.now(),
    roundStartTime: Date.now()
  };

  const engines = [
    new Engine(EVMChecker, "rpcs/eth.txt",       "data/evm_input.txt", "output/active.txt", "ETH"),
    new Engine(EVMChecker, "rpcs/bsc.txt",       "data/evm_input.txt", "output/active.txt", "BSC"),
    new Engine(EVMChecker, "rpcs/polygon.txt",   "data/evm_input.txt", "output/active.txt", "POL"),
    new Engine(EVMChecker, "rpcs/base.txt",      "data/evm_input.txt", "output/active.txt", "BASE"),
    new Engine(EVMChecker, "rpcs/arbitrum.txt",  "data/evm_input.txt", "output/active.txt", "ARBITRUM"),
    new Engine(EVMChecker, "rpcs/avalanche.txt", "data/evm_input.txt", "output/active.txt", "AVALANCHE"),
    new Engine(EVMChecker, "rpcs/gnosis.txt",    "data/evm_input.txt", "output/active.txt", "GNOSIS"),
    new Engine(BTCChecker, "rpcs/btc.txt",       "data/btc_input.txt", "output/active.txt", "BTC"),
    new Engine(SolChecker, "rpcs/sol.txt",       "data/sol_input.txt", "output/active.txt", "SOL"),
    new Engine(SUIChecker, "rpcs/sui.txt",       "data/sui_input.txt", "output/active.txt", "SUI")
  ];

  dashboard(engines, state);

  while (true) {
    state.round += 1;
    state.scanning = false;
    state.roundStartTime = Date.now();

    const { wallets } = await generateWallets({ count, silent: true });
    const { evmMap, btcMap, solMap, suiMap } = buildMaps(wallets);

    for (const engine of engines) {
      const ch = engine.chain.toLowerCase();
      if (["eth", "bsc", "pol", "base", "arbitrum", "avalanche", "gnosis"].includes(ch)) engine.walletMap = evmMap;
      else if (ch === "btc") engine.walletMap = btcMap;
      else if (ch === "sol") engine.walletMap = solMap;
      else if (ch === "sui") engine.walletMap = suiMap;
      engine.reset();
    }

    state.scanning = true;

    await Promise.all(engines.map((e) => e.run()));

    state.lifetimeActive    += engines.reduce((t, e) => t + e.active,    0);
    state.lifetimeInactive  += engines.reduce((t, e) => t + e.inactive,  0);
    state.lifetimeProcessed += engines.reduce((t, e) => t + e.processed, 0);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
