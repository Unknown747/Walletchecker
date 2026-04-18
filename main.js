const { Engine } = require("./core/engine");
const { EVMChecker } = require("./checkers/evmChecker");
const { BTCChecker } = require("./checkers/btcChecker");
const { SolChecker } = require("./checkers/solChecker");
const { SUIChecker } = require("./checkers/suiChecker");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printEngineStatus(status) {
  console.log(
    `${status.chain.toUpperCase()} | ` +
    `Processed: ${status.processed} | ` +
    `Active: ${status.active} | ` +
    `Inactive: ${status.inactive} | ` +
    `Retries: ${status.retries}`
  );

  for (const rpc of status.rpcStatus) {
    console.log(`   RPC: ${rpc.url} -> ${rpc.state}`);
  }
}

async function dashboard(engines) {
  while (true) {
    process.stdout.write("\x1Bc");
    console.log("===== EVM Chains =====");

    for (const engine of engines) {
      if (["eth", "bsc", "pol", "base", "arbitrum", "avalanche", "gnosis"].includes(engine.chain.toLowerCase())) {
        printEngineStatus(engine.status());
      }
    }

    console.log("\n=== Other Chains ===");
    for (const engine of engines) {
      if (["btc", "sol", "sui"].includes(engine.chain.toLowerCase())) {
        printEngineStatus(engine.status());
      }
    }

    const activeTotal = engines.reduce((total, engine) => total + engine.active, 0);
    const inactiveTotal = engines.reduce((total, engine) => total + engine.inactive, 0);
    console.log(`\n=== TOTAL ===\nACTIVE ADDYS: ${activeTotal}\nINACTIVE ADDYS: ${inactiveTotal}`);
    await sleep(2000);
  }
}

async function main() {
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

  await Promise.all([
    ...engines.map((engine) => engine.run()),
    dashboard(engines)
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});