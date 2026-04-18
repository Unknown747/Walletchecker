const { Engine } = require("./core/engine");
const { EVMChecker } = require("./checkers/evmChecker");
const { BTCChecker } = require("./checkers/btcChecker");
const { SolChecker } = require("./checkers/solChecker");
const { SUIChecker } = require("./checkers/suiChecker");
const { generateWallets, parseCount } = require("./generateWallets");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printEngineStatus(status) {
  const rpcRetrying = status.rpcStatus.filter((rpc) => rpc.state !== "available").length;
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

    const activeTotal = engines.reduce((total, engine) => total + engine.active, 0);
    const inactiveTotal = engines.reduce((total, engine) => total + engine.inactive, 0);
    const processedTotal = engines.reduce((total, engine) => total + engine.processed, 0);
    const retriesTotal = engines.reduce((total, engine) => total + engine.retries, 0);

    const lifetimeActive = state.lifetimeActive + activeTotal;
    const lifetimeProcessed = state.lifetimeProcessed + processedTotal;

    console.log("Wallet Checker [Continuous Mode]");
    console.log("=================================");
    console.log(`Round: ${state.round} | Lifetime Checked: ${lifetimeProcessed} | Lifetime Active: ${lifetimeActive}`);
    console.log(`This Round  — Checked: ${processedTotal} | Active: ${activeTotal} | Inactive: ${inactiveTotal} | Retries: ${retriesTotal}`);
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
    console.log(`Private keys saved in wallets/  |  Status: ${state.scanning ? "Scanning..." : "Generating..."}`);

    await sleep(2000);
  }
}

async function main() {
  const count = parseCount();

  const engines = [
    new Engine(EVMChecker, "rpcs/eth.txt", "data/evm_input.txt", "output/active.txt", "output/inactive_evm.txt", "ETH"),
    new Engine(EVMChecker, "rpcs/bsc.txt", "data/evm_input.txt", "output/active.txt", "output/inactive_evm.txt", "BSC"),
    new Engine(EVMChecker, "rpcs/polygon.txt", "data/evm_input.txt", "output/active.txt", "output/inactive_evm.txt", "POL"),
    new Engine(EVMChecker, "rpcs/base.txt", "data/evm_input.txt", "output/active.txt", "output/inactive_evm.txt", "BASE"),
    new Engine(EVMChecker, "rpcs/arbitrum.txt", "data/evm_input.txt", "output/active.txt", "output/inactive_evm.txt", "ARBITRUM"),
    new Engine(EVMChecker, "rpcs/avalanche.txt", "data/evm_input.txt", "output/active.txt", "output/inactive_evm.txt", "AVALANCHE"),
    new Engine(EVMChecker, "rpcs/gnosis.txt", "data/evm_input.txt", "output/active.txt", "output/inactive_evm.txt", "GNOSIS"),
    new Engine(BTCChecker, "rpcs/btc.txt", "data/btc_input.txt", "output/active.txt", "output/inactive_btc.txt", "BTC"),
    new Engine(SolChecker, "rpcs/sol.txt", "data/sol_input.txt", "output/active.txt", "output/inactive_sol.txt", "SOL"),
    new Engine(SUIChecker, "rpcs/sui.txt", "data/sui_input.txt", "output/active.txt", "output/inactive_sui.txt", "SUI")
  ];

  const state = {
    round: 0,
    scanning: false,
    lifetimeActive: 0,
    lifetimeInactive: 0,
    lifetimeProcessed: 0
  };

  dashboard(engines, state);

  while (true) {
    state.round += 1;
    state.scanning = false;

    await generateWallets({ count, silent: true });

    for (const engine of engines) {
      engine.reset();
    }

    state.scanning = true;

    await Promise.all(engines.map((engine) => engine.run()));

    state.lifetimeActive += engines.reduce((total, engine) => total + engine.active, 0);
    state.lifetimeInactive += engines.reduce((total, engine) => total + engine.inactive, 0);
    state.lifetimeProcessed += engines.reduce((total, engine) => total + engine.processed, 0);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
