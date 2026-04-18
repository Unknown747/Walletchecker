const { Engine } = require("./core/engine");
const { EVMChecker } = require("./checkers/evmChecker");
const { BTCChecker } = require("./checkers/btcChecker");
const { SolChecker } = require("./checkers/solChecker");
const { SUIChecker } = require("./checkers/suiChecker");
const { generateWallets, parseCount } = require("./generateWallets");

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
      mnemonic: w.mnemonic,
      evm: w.evm, btc: w.btc, sol: w.sol, sui: w.sui,
      evmPrivateKey: w.evmPrivateKey,
      btcPrivateKeyWif: w.btcPrivateKeyWif,
      solSecretKey: w.solSecretKey,
      suiSecretKey: w.suiSecretKey
    };
    evmMap.set(w.evm, keyData);
    btcMap.set(w.btc, keyData);
    solMap.set(w.sol, keyData);
    suiMap.set(w.sui, keyData);
  }

  return { evmMap, btcMap, solMap, suiMap };
}

function printEngineStatus(status) {
  const rpcRetrying = status.rpcStatus.filter((r) => r.state !== "available").length;
  const rpcTotal = status.rpcStatus.length;

  console.log(
    `${status.chain.padEnd(9)} ` +
    `checked=${String(status.processed).padStart(4)} ` +
    `active=${String(status.active).padStart(4)} ` +
    `inactive=${String(status.inactive).padStart(4)} ` +
    `rpc=${rpcTotal - rpcRetrying}/${rpcTotal}`
  );
}

async function dashboard(engines, state) {
  const EVM_CHAINS = ["eth", "bsc", "pol", "base", "arbitrum", "avalanche", "gnosis"];
  const OTHER_CHAINS = ["btc", "sol", "sui"];

  while (true) {
    process.stdout.write("\x1Bc");

    const roundChecked = engines.reduce((t, e) => t + e.processed, 0);
    const roundActive = engines.reduce((t, e) => t + e.active, 0);
    const roundInactive = engines.reduce((t, e) => t + e.inactive, 0);
    const roundRetries = engines.reduce((t, e) => t + e.retries, 0);

    console.log("Wallet Checker [Continuous Mode]");
    console.log("=================================");
    console.log(`Round : ${state.round}  |  Status: ${state.scanning ? "Scanning..." : "Generating..."}`);
    console.log(`Round   — Checked: ${roundChecked} | Active: ${roundActive} | Inactive: ${roundInactive} | Retries: ${roundRetries}`);
    console.log(`Lifetime— Checked: ${state.lifetimeProcessed + roundChecked} | Active: ${state.lifetimeActive + roundActive}`);
    console.log("");
    console.log("Chain     checked active inactive rpc");
    console.log("-------------------------------------");

    for (const engine of engines) {
      if (EVM_CHAINS.includes(engine.chain.toLowerCase())) printEngineStatus(engine.status());
    }
    for (const engine of engines) {
      if (OTHER_CHAINS.includes(engine.chain.toLowerCase())) printEngineStatus(engine.status());
    }

    console.log("-------------------------------------");
    console.log("1 mnemonic = EVM + BTC + SOL + SUI  |  Active keys -> output/active_keys.txt");

    await sleep(2000);
  }
}

async function main() {
  const count = parseCount();

  const state = {
    round: 0,
    scanning: false,
    lifetimeActive: 0,
    lifetimeInactive: 0,
    lifetimeProcessed: 0
  };

  const engines = [
    new Engine(EVMChecker, "rpcs/eth.txt",      "data/evm_input.txt", "output/active.txt", "ETH"),
    new Engine(EVMChecker, "rpcs/bsc.txt",      "data/evm_input.txt", "output/active.txt", "BSC"),
    new Engine(EVMChecker, "rpcs/polygon.txt",  "data/evm_input.txt", "output/active.txt", "POL"),
    new Engine(EVMChecker, "rpcs/base.txt",     "data/evm_input.txt", "output/active.txt", "BASE"),
    new Engine(EVMChecker, "rpcs/arbitrum.txt", "data/evm_input.txt", "output/active.txt", "ARBITRUM"),
    new Engine(EVMChecker, "rpcs/avalanche.txt","data/evm_input.txt", "output/active.txt", "AVALANCHE"),
    new Engine(EVMChecker, "rpcs/gnosis.txt",   "data/evm_input.txt", "output/active.txt", "GNOSIS"),
    new Engine(BTCChecker, "rpcs/btc.txt",      "data/btc_input.txt", "output/active.txt", "BTC"),
    new Engine(SolChecker, "rpcs/sol.txt",      "data/sol_input.txt", "output/active.txt", "SOL"),
    new Engine(SUIChecker, "rpcs/sui.txt",      "data/sui_input.txt", "output/active.txt", "SUI")
  ];

  dashboard(engines, state);

  while (true) {
    state.round += 1;
    state.scanning = false;

    const { wallets } = await generateWallets({ count, silent: true });
    const { evmMap, btcMap, solMap, suiMap } = buildMaps(wallets);

    for (const engine of engines) {
      const c = engine.chain.toLowerCase();
      if (["eth", "bsc", "pol", "base", "arbitrum", "avalanche", "gnosis"].includes(c)) engine.walletMap = evmMap;
      else if (c === "btc") engine.walletMap = btcMap;
      else if (c === "sol") engine.walletMap = solMap;
      else if (c === "sui") engine.walletMap = suiMap;
      engine.reset();
    }

    state.scanning = true;

    await Promise.all(engines.map((e) => e.run()));

    state.lifetimeActive += engines.reduce((t, e) => t + e.active, 0);
    state.lifetimeInactive += engines.reduce((t, e) => t + e.inactive, 0);
    state.lifetimeProcessed += engines.reduce((t, e) => t + e.processed, 0);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
