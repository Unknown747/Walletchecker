const { Engine } = require("./core/engine");
const { EVMChecker } = require("./checkers/evmChecker");
const { BTCChecker } = require("./checkers/btcChecker");
const { SolChecker } = require("./checkers/solChecker");
const { SUIChecker } = require("./checkers/suiChecker");
const { generateWallets, parseCount } = require("./generateWallets");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildWalletMap(wallets) {
  const map = new Map();
  for (const w of wallets) {
    const { address, ...keyData } = w;
    map.set(address, keyData);
  }
  return map;
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
      if (["eth", "bsc", "pol", "base", "arbitrum", "avalanche", "gnosis"].includes(engine.chain.toLowerCase())) {
        printEngineStatus(engine.status());
      }
    }

    for (const engine of engines) {
      if (["btc", "sol", "sui"].includes(engine.chain.toLowerCase())) {
        printEngineStatus(engine.status());
      }
    }

    console.log("-------------------------------------");
    console.log("Active keys saved to output/active_keys.txt");

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
    new Engine(EVMChecker, "rpcs/eth.txt", "data/evm_input.txt", "output/active.txt", "ETH"),
    new Engine(EVMChecker, "rpcs/bsc.txt", "data/evm_input.txt", "output/active.txt", "BSC"),
    new Engine(EVMChecker, "rpcs/polygon.txt", "data/evm_input.txt", "output/active.txt", "POL"),
    new Engine(EVMChecker, "rpcs/base.txt", "data/evm_input.txt", "output/active.txt", "BASE"),
    new Engine(EVMChecker, "rpcs/arbitrum.txt", "data/evm_input.txt", "output/active.txt", "ARBITRUM"),
    new Engine(EVMChecker, "rpcs/avalanche.txt", "data/evm_input.txt", "output/active.txt", "AVALANCHE"),
    new Engine(EVMChecker, "rpcs/gnosis.txt", "data/evm_input.txt", "output/active.txt", "GNOSIS"),
    new Engine(BTCChecker, "rpcs/btc.txt", "data/btc_input.txt", "output/active.txt", "BTC"),
    new Engine(SolChecker, "rpcs/sol.txt", "data/sol_input.txt", "output/active.txt", "SOL"),
    new Engine(SUIChecker, "rpcs/sui.txt", "data/sui_input.txt", "output/active.txt", "SUI")
  ];

  dashboard(engines, state);

  while (true) {
    state.round += 1;
    state.scanning = false;

    const { evmWallets, btcWallets, solWallets, suiWallets } = await generateWallets({ count, silent: true });

    const evmMap = buildWalletMap(evmWallets);
    const btcMap = buildWalletMap(btcWallets);
    const solMap = buildWalletMap(solWallets);
    const suiMap = buildWalletMap(suiWallets);

    for (const engine of engines) {
      const chainLower = engine.chain.toLowerCase();
      if (["eth", "bsc", "pol", "base", "arbitrum", "avalanche", "gnosis"].includes(chainLower)) {
        engine.walletMap = evmMap;
      } else if (chainLower === "btc") {
        engine.walletMap = btcMap;
      } else if (chainLower === "sol") {
        engine.walletMap = solMap;
      } else if (chainLower === "sui") {
        engine.walletMap = suiMap;
      }
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
