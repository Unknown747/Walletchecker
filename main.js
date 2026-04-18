const fs = require("fs");

const config = require("./core/config");
const { Engine } = require("./core/engine");
const { EVMChecker } = require("./checkers/evmChecker");
const { BTCChecker } = require("./checkers/btcChecker");
const { SolChecker } = require("./checkers/solChecker");
const { SUIChecker } = require("./checkers/suiChecker");
const { generateWallets, parseCount } = require("./generateWallets");

// ── Chain registry ────────────────────────────────────────────────────────────
const ALL_CHAINS = [
  { id: "eth",       type: "evm", label: "ETH",       rpcFile: "rpcs/eth.txt",       inputFile: "data/evm_input.txt" },
  { id: "bsc",       type: "evm", label: "BSC",       rpcFile: "rpcs/bsc.txt",       inputFile: "data/evm_input.txt" },
  { id: "pol",       type: "evm", label: "POL",       rpcFile: "rpcs/polygon.txt",   inputFile: "data/evm_input.txt" },
  { id: "base",      type: "evm", label: "BASE",      rpcFile: "rpcs/base.txt",      inputFile: "data/evm_input.txt" },
  { id: "arbitrum",  type: "evm", label: "ARBITRUM",  rpcFile: "rpcs/arbitrum.txt",  inputFile: "data/evm_input.txt" },
  { id: "avalanche", type: "evm", label: "AVALANCHE", rpcFile: "rpcs/avalanche.txt", inputFile: "data/evm_input.txt" },
  { id: "gnosis",    type: "evm", label: "GNOSIS",    rpcFile: "rpcs/gnosis.txt",    inputFile: "data/evm_input.txt" },
  { id: "optimism",  type: "evm", label: "OPTIMISM",  rpcFile: "rpcs/optimism.txt",  inputFile: "data/evm_input.txt" },
  { id: "fantom",    type: "evm", label: "FANTOM",    rpcFile: "rpcs/fantom.txt",    inputFile: "data/evm_input.txt" },
  { id: "zksync",    type: "evm", label: "ZKSYNC",    rpcFile: "rpcs/zksync.txt",    inputFile: "data/evm_input.txt" },
  { id: "btc",       type: "btc", label: "BTC",       rpcFile: "rpcs/btc.txt",       inputFile: "data/btc_input.txt" },
  { id: "sol",       type: "sol", label: "SOL",       rpcFile: "rpcs/sol.txt",       inputFile: "data/sol_input.txt" },
  { id: "sui",       type: "sui", label: "SUI",       rpcFile: "rpcs/sui.txt",       inputFile: "data/sui_input.txt" }
];

const CHECKERS = { evm: EVMChecker, btc: BTCChecker, sol: SolChecker, sui: SUIChecker };
const ACTIVE_FILE = "output/active.txt";

// ── Stats persistence ────────────────────────────────────────────────────────
function loadStats() {
  try {
    return JSON.parse(fs.readFileSync(config.statsFile, "utf8"));
  } catch {
    return { lifetimeChecked: 0, lifetimeActive: 0, lifetimeRounds: 0 };
  }
}

function saveStats(state) {
  fs.mkdirSync("output", { recursive: true });
  fs.writeFileSync(config.statsFile, JSON.stringify({
    lifetimeChecked: state.lifetimeProcessed,
    lifetimeActive:  state.lifetimeActive,
    lifetimeRounds:  state.round,
    lastRun:         new Date().toISOString()
  }, null, 2));
}

// ── Wallet maps ───────────────────────────────────────────────────────────────
function buildMaps(wallets) {
  const maps = { evm: new Map(), btc: new Map(), sol: new Map(), sui: new Map() };

  for (const w of wallets) {
    const keyData = {
      mnemonic:         w.mnemonic,
      evm:              w.evm,
      btc:              w.btc,
      sol:              w.sol,
      sui:              w.sui,
      evmPrivateKey:    w.evmPrivateKey,
      btcPrivateKeyWif: w.btcPrivateKeyWif,
      solSecretKey:     w.solSecretKey,
      suiSecretKey:     w.suiSecretKey
    };
    maps.evm.set(w.evm, keyData);
    maps.btc.set(w.btc, keyData);
    maps.sol.set(w.sol, keyData);
    maps.sui.set(w.sui, keyData);
  }

  return maps;
}

// ── ANSI / display helpers ───────────────────────────────────────────────────
const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  cyan:    "\x1b[36m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  red:     "\x1b[31m",
  white:   "\x1b[37m",
  gray:    "\x1b[90m",
  bCyan:   "\x1b[1m\x1b[36m",
  bGreen:  "\x1b[1m\x1b[32m",
  bYellow: "\x1b[1m\x1b[33m",
  bWhite:  "\x1b[1m\x1b[37m"
};

const W = 68;

function c(color, text) { return `${color}${text}${C.reset}`; }

function stripAnsi(s) { return String(s).replace(/\x1b\[[0-9;]*m/g, ""); }

function fillLine(content) {
  const vis = stripAnsi(content);
  const pad = W - vis.length - 2;
  return `${C.gray}│${C.reset} ${content}${" ".repeat(Math.max(pad, 0))} ${C.gray}│${C.reset}`;
}

function divider(l = "├", m = "─", r = "┤") {
  return `${C.gray}${l}${m.repeat(W)}${r}${C.reset}`;
}

function centerHeader(title) {
  const pl = Math.floor((W - title.length) / 2) - 1;
  const pr = W - title.length - pl - 2;
  return `${C.gray}║${C.reset}${" ".repeat(pl)} ${c(C.bCyan, title)} ${" ".repeat(pr)}${C.gray}║${C.reset}`;
}

function elapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [h, m, s % 60].map((v) => String(v).padStart(2, "0")).join(":");
}

function progressBar(done, total, width = 34) {
  const pct  = total > 0 ? Math.min(done / total, 1) : 0;
  const fill = Math.round(pct * width);
  return `${c(C.green, "█".repeat(fill))}${c(C.gray, "░".repeat(width - fill))} ${c(C.bWhite, `${Math.round(pct * 100)}%`)}`;
}

function rpcColor(avail, total) {
  if (total === 0) return c(C.gray, "0/0");
  const ratio = avail / total;
  const color = ratio === 1 ? C.green : ratio >= 0.5 ? C.yellow : C.red;
  return c(color, `${avail}/${total}`);
}

function tableRow(chain, checked, active, inactive, retries, rpcAvail, rpcTotal) {
  const chainStr = c(active > 0 ? C.bGreen : C.white, chain.padEnd(10));
  const chkStr   = c(C.white,                          String(checked).padStart(7));
  const actStr   = c(active > 0 ? C.bGreen : C.gray,  String(active).padStart(7));
  const inStr    = c(C.dim,                            String(inactive).padStart(9));
  const retStr   = c(retries > 0 ? C.yellow : C.gray, String(retries).padStart(7));
  const rpcStr   = rpcColor(rpcAvail, rpcTotal);

  const content  = `${chainStr} ${chkStr} ${actStr} ${inStr} ${retStr}  ${rpcStr}`;
  const vis      = 10 + 1 + 7 + 1 + 7 + 1 + 9 + 1 + 7 + 2 + stripAnsi(rpcStr).length;
  return fillLine(`${content}${" ".repeat(Math.max(W - 2 - vis, 0))}`);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function dashboard(engines, state) {
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  const evmEngines   = engines.filter((e) => !["BTC", "SOL", "SUI"].includes(e.chain));
  const otherEngines = engines.filter((e) =>  ["BTC", "SOL", "SUI"].includes(e.chain));

  while (true) {
    const roundChecked  = engines.reduce((t, e) => t + e.processed, 0);
    const roundActive   = engines.reduce((t, e) => t + e.active,    0);
    const roundInactive = engines.reduce((t, e) => t + e.inactive,  0);
    const roundRetries  = engines.reduce((t, e) => t + e.retries,   0);

    const lifeChecked = state.lifetimeProcessed + roundChecked;
    const lifeActive  = state.lifetimeActive    + roundActive;

    const now     = Date.now();
    const uptime  = elapsed(now - state.totalStartTime);
    const roundEl = elapsed(now - state.roundStartTime);
    const speed   = now - state.totalStartTime > 500
      ? (lifeChecked / ((now - state.totalStartTime) / 1000) / engines.length).toFixed(1)
      : "0.0";

    const totalPerRound = state.count * engines.length;
    const statusLabel   = state.scanning
      ? c(C.bGreen,  "▶ SCANNING  ")
      : c(C.bYellow, "⟳ GENERATING");

    const out = [
      divider("╔", "═", "╗"),
      centerHeader("MULTI-CHAIN WALLET SCANNER"),
      divider("╠", "═", "╣"),

      fillLine(
        `${c(C.gray, "Round  ")}${c(C.bWhite, `#${state.round}`)}` +
        `   ${c(C.gray, "Status ")}${statusLabel}` +
        `   ${c(C.gray, new Date().toTimeString().slice(0, 8))}`
      ),
      fillLine(
        `${c(C.gray, "Uptime ")}${c(C.white, uptime)}` +
        `   ${c(C.gray, "Round  ")}${c(C.white, roundEl)}` +
        `   ${c(C.gray, "Speed  ")}${c(C.yellow, `${speed} w/s/chain`)}`
      ),

      divider("╠", "═", "╣"),

      fillLine(
        `${c(C.gray, "Round   ")} ${c(C.bWhite, roundChecked)} checked` +
        `  ${roundActive > 0 ? c(C.bGreen, `${roundActive} ACTIVE`) : c(C.gray, "0 active")}` +
        `  ${c(C.dim, `${roundInactive} inactive`)}` +
        `${roundRetries > 0 ? `  ${c(C.yellow, `${roundRetries} retried`)}` : ""}`
      ),
      fillLine(
        `${c(C.gray, "Lifetime")} ${c(C.bWhite, lifeChecked)} checked` +
        `  ${lifeActive > 0 ? c(C.bGreen, `${lifeActive} ACTIVE FOUND`) : c(C.gray, "0 active found")}` +
        `  ${c(C.gray, `${state.round} rounds`)}`
      ),
      fillLine(`${c(C.gray, "Progress ")}${progressBar(roundChecked, totalPerRound)}`),

      divider("╠", "═", "╣"),
      fillLine(
        `${c(C.bCyan, "Chain".padEnd(10))} ` +
        `${c(C.bCyan, "Checked".padStart(7))} ` +
        `${c(C.bCyan, "Active".padStart(7))} ` +
        `${c(C.bCyan, "Inactive".padStart(9))} ` +
        `${c(C.bCyan, "Retried".padStart(7))}  ` +
        `${c(C.bCyan, "RPC")}`
      ),
      divider("╠", "═", "╣"),

      ...evmEngines.map((e) => {
        const s = e.status();
        const avail = s.rpcStatus.filter((r) => r.state === "available").length;
        return tableRow(s.chain, s.processed, s.active, s.inactive, s.retries, avail, s.rpcStatus.length);
      }),

      divider("╠", "─", "╣"),

      ...otherEngines.map((e) => {
        const s = e.status();
        const avail = s.rpcStatus.filter((r) => r.state === "available").length;
        return tableRow(s.chain, s.processed, s.active, s.inactive, s.retries, avail, s.rpcStatus.length);
      }),

      divider("╠", "═", "╣"),
      fillLine(`${c(C.gray, "1 seed → EVM + BTC + SOL + SUI")}   ${c(C.dim, "hits → output/active_keys.txt")}`),
      divider("╚", "═", "╝")
    ];

    process.stdout.write("\x1Bc");
    console.log(out.join("\n"));

    await sleep(2000);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const count = parseCount();
  const saved = loadStats();

  const state = {
    round:            saved.lifetimeRounds  || 0,
    count,
    scanning:         false,
    lifetimeActive:   saved.lifetimeActive  || 0,
    lifetimeInactive: 0,
    lifetimeProcessed: saved.lifetimeChecked || 0,
    totalStartTime:   Date.now(),
    roundStartTime:   Date.now()
  };

  const activeChains = ALL_CHAINS.filter((ch) => config.chains[ch.id] !== false);

  const engines = activeChains.map(
    (ch) => new Engine(CHECKERS[ch.type], ch.rpcFile, ch.inputFile, ACTIVE_FILE, ch.label)
  );

  dashboard(engines, state);

  while (true) {
    state.round += 1;
    state.scanning = false;
    state.roundStartTime = Date.now();

    const { wallets } = await generateWallets({ count, silent: true });
    const maps = buildMaps(wallets);

    for (let i = 0; i < engines.length; i += 1) {
      engines[i].walletMap = maps[activeChains[i].type];
      engines[i].reset();
    }

    state.scanning = true;

    await Promise.all(engines.map((e) => e.run()));

    state.lifetimeActive    += engines.reduce((t, e) => t + e.active,    0);
    state.lifetimeInactive  += engines.reduce((t, e) => t + e.inactive,  0);
    state.lifetimeProcessed += engines.reduce((t, e) => t + e.processed, 0);

    saveStats(state);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
