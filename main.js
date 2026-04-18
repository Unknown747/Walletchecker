const fs = require("fs");

const config  = require("./core/config");
const { Engine }       = require("./core/engine");
const { EVMChecker }   = require("./checkers/evmChecker");
const { BTCChecker }   = require("./checkers/btcChecker");
const { SolChecker }   = require("./checkers/solChecker");
const { SUIChecker }   = require("./checkers/suiChecker");
const { generateWallets, parseCount } = require("./generateWallets");

// ─── Chain registry ───────────────────────────────────────────────────────────
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

const CHECKERS   = { evm: EVMChecker, btc: BTCChecker, sol: SolChecker, sui: SUIChecker };
const ACTIVE_FILE = "output/active.txt";

// ─── Stats persistence ────────────────────────────────────────────────────────
function loadStats() {
  try { return JSON.parse(fs.readFileSync(config.statsFile, "utf8")); }
  catch { return { lifetimeChecked: 0, lifetimeActive: 0, lifetimeRounds: 0 }; }
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

// ─── Wallet maps ──────────────────────────────────────────────────────────────
function buildMaps(wallets) {
  const maps = { evm: new Map(), btc: new Map(), sol: new Map(), sui: new Map() };
  for (const w of wallets) {
    const keyData = {
      mnemonic: w.mnemonic, evm: w.evm, btc: w.btc, sol: w.sol, sui: w.sui,
      evmPrivateKey: w.evmPrivateKey, btcPrivateKeyWif: w.btcPrivateKeyWif,
      solSecretKey: w.solSecretKey,   suiSecretKey: w.suiSecretKey
    };
    maps.evm.set(w.evm, keyData);
    maps.btc.set(w.btc, keyData);
    maps.sol.set(w.sol, keyData);
    maps.sui.set(w.sui, keyData);
  }
  return maps;
}

// ─── ANSI colours ─────────────────────────────────────────────────────────────
const A = {
  reset:   "\x1b[0m",
  dim:     "\x1b[2m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  red:     "\x1b[31m",
  cyan:    "\x1b[36m",
  white:   "\x1b[37m",
  gray:    "\x1b[90m",
  bGreen:  "\x1b[1m\x1b[32m",
  bYellow: "\x1b[1m\x1b[33m",
  bCyan:   "\x1b[1m\x1b[36m",
  bWhite:  "\x1b[1m\x1b[37m"
};

const R = A.reset;

// ─── Layout constants ──────────────────────────────────────────────────────────
//  Total visible width: ║ + space + CONTENT(66) + space + ║ = 70
const INNER = 66;

// Table column visible widths (sum = INNER = 66)
// chain(10) + sp + checked(8) + sp + active(7) + sp + inactive(9) + sp + retry(7) + sp(3) + rpc(18) = 66
const COL = { chain: 10, checked: 8, active: 7, inactive: 9, retry: 7, rpc: 18 };

// ─── Render primitives ────────────────────────────────────────────────────────
// All pad operations use plain strings (no ANSI) → exact visible widths guaranteed.

function hline(L, fill, R) { return `${A.gray}${L}${fill.repeat(INNER + 2)}${R}${A.reset}`; }

const top   = () => hline("╔", "═", "╗");
const btm   = () => hline("╚", "═", "╝");
const heavy = () => hline("╠", "═", "╣");
const light = () => hline("╟", "─", "╢");

// Wrap INNER-width visible content inside ║ borders
function row(content) {
  const vis = content.replace(/\x1b\[[0-9;]*m/g, "").length;
  const pad = INNER - vis;
  return `${A.gray}║${R} ${content}${" ".repeat(Math.max(pad, 0))} ${A.gray}║${R}`;
}

// Centered bold-cyan title row
function titleRow(text) {
  const pl = Math.floor((INNER - text.length) / 2) - 1;
  const pr = INNER - text.length - pl - 2;
  return `${A.gray}║${R}${" ".repeat(pl)} ${A.bCyan}${text}${R} ${" ".repeat(Math.max(pr, 0))}${A.gray}║${R}`;
}

function elapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

function progressBar(done, total) {
  const pct  = total > 0 ? Math.min(done / total, 1) : 0;
  const fill = Math.round(pct * 40);
  const bar  = `${A.bGreen}${"█".repeat(fill)}${A.gray}${"░".repeat(40 - fill)}${R}`;
  const pctStr = `${Math.round(pct * 100)}%`.padStart(4);
  return `${A.gray}Progress${R}  ${bar} ${A.bWhite}${pctStr}${R}`;
}

// ─── Table row (exact fixed-width columns, then coloured) ─────────────────────
function tableRow(chain, checked, active, inactive, retry, rpcAvail, rpcTotal) {
  // Build plain padded cells first — visible width is deterministic
  const cChain    = chain.padEnd(COL.chain);
  const cChecked  = String(checked).padStart(COL.checked);
  const cActive   = String(active).padStart(COL.active);
  const cInactive = String(inactive).padStart(COL.inactive);
  const cRetry    = String(retry).padStart(COL.retry);
  const rpcStr    = `${rpcAvail}/${rpcTotal}`;
  const cRpc      = rpcStr.padStart(COL.rpc);

  const rpcRatio  = rpcTotal > 0 ? rpcAvail / rpcTotal : 1;
  const rpcColor  = rpcRatio === 1 ? A.green : rpcRatio >= 0.5 ? A.yellow : A.red;

  const colored =
    (active > 0 ? A.bGreen : A.white) + cChain + R + " " +
    A.white  + cChecked  + R + " " +
    (active > 0 ? A.bGreen : A.gray) + cActive + R + " " +
    A.dim    + cInactive + R + " " +
    (retry > 0 ? A.yellow : A.gray) + cRetry + R + "   " +
    rpcColor + cRpc + R;

  return row(colored);
}

function tableHeader() {
  const h =
    A.bCyan + "Chain".padEnd(COL.chain) + R + " " +
    A.bCyan + "Checked".padStart(COL.checked) + R + " " +
    A.bCyan + "Active".padStart(COL.active) + R + " " +
    A.bCyan + "Inactive".padStart(COL.inactive) + R + " " +
    A.bCyan + "Retry".padStart(COL.retry) + R + "   " +
    A.bCyan + "RPC".padStart(COL.rpc) + R;
  return row(h);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
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

    const now      = Date.now();
    const uptime   = elapsed(now - state.totalStartTime);
    const roundEl  = elapsed(now - state.roundStartTime);
    const wallRate = now - state.totalStartTime > 500
      ? (lifeChecked / ((now - state.totalStartTime) / 1000) / engines.length).toFixed(1)
      : "0.0";

    const totalPerRound = state.count * engines.length;
    const timeStr       = new Date().toTimeString().slice(0, 8);
    const statusText    = state.scanning ? `${A.bGreen}▶ SCANNING  ${R}` : `${A.bYellow}⟳ GENERATING${R}`;

    // ── Status block ─
    const statusLine =
      `${A.gray}Round${R}  ${A.bWhite}#${state.round}${R}` +
      `   ${A.gray}Status${R} ${statusText}` +
      `   ${A.gray}${timeStr}${R}`;

    const timeLine =
      `${A.gray}Uptime${R} ${A.white}${uptime}${R}` +
      `   ${A.gray}Round${R} ${A.white}${roundEl}${R}` +
      `   ${A.gray}Speed${R} ${A.yellow}${wallRate} w/s/chain${R}`;

    // ── Stats block ─
    const rndActive = roundActive > 0 ? `${A.bGreen}${String(roundActive).padStart(6)}${R}` : `${A.gray}${String(0).padStart(6)}${R}`;
    const rndLine =
      `${A.gray}Round   ${R}${A.bWhite}${String(roundChecked).padStart(7)}${R} checked` +
      `  ${rndActive} active` +
      `  ${A.dim}${String(roundInactive).padStart(7)}${R} inactive` +
      `  ${roundRetries > 0 ? `${A.yellow}${roundRetries} retried${R}` : ""}`;

    const lifeActiveStr = lifeActive > 0
      ? `${A.bGreen}${String(lifeActive).padStart(6)}${R}`
      : `${A.gray}${String(0).padStart(6)}${R}`;
    const lifeLine =
      `${A.gray}Lifetime${R}${A.bWhite}${String(lifeChecked).padStart(7)}${R} checked` +
      `  ${lifeActiveStr} active` +
      `  ${A.gray}${String(state.round).padStart(7)}${R} rounds`;

    // ── Build frame ─
    const lines = [
      "",
      top(),
      titleRow("◈  MULTI-CHAIN WALLET SCANNER  ◈"),
      heavy(),
      row(statusLine),
      row(timeLine),
      heavy(),
      row(rndLine),
      row(lifeLine),
      row(progressBar(roundChecked, totalPerRound)),
      heavy(),
      tableHeader(),
      heavy(),
      ...evmEngines.map((e) => {
        const s = e.status();
        const avail = s.rpcStatus.filter((r) => r.state === "available").length;
        return tableRow(s.chain, s.processed, s.active, s.inactive, s.retries, avail, s.rpcStatus.length);
      }),
      light(),
      ...otherEngines.map((e) => {
        const s = e.status();
        const avail = s.rpcStatus.filter((r) => r.state === "available").length;
        return tableRow(s.chain, s.processed, s.active, s.inactive, s.retries, avail, s.rpcStatus.length);
      }),
      heavy(),
      row(`${A.gray}1 seed → EVM · BTC · SOL · SUI${R}  ${A.dim}·  hits → active_keys.txt${R}`),
      btm(),
      ""
    ];

    process.stdout.write("\x1Bc");
    process.stdout.write(lines.join("\n"));

    await sleep(2000);
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────
async function main() {
  const count  = parseCount();
  const saved  = loadStats();

  const state = {
    round:             saved.lifetimeRounds  || 0,
    count,
    scanning:          false,
    lifetimeActive:    saved.lifetimeActive  || 0,
    lifetimeInactive:  0,
    lifetimeProcessed: saved.lifetimeChecked || 0,
    totalStartTime:    Date.now(),
    roundStartTime:    Date.now()
  };

  const activeChains = ALL_CHAINS.filter((ch) => config.chains[ch.id] !== false);

  const engines = activeChains.map(
    (ch) => new Engine(CHECKERS[ch.type], ch.rpcFile, ch.inputFile, ACTIVE_FILE, ch.label)
  );

  dashboard(engines, state);

  while (true) {
    state.round        += 1;
    state.scanning      = false;
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
