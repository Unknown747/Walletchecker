# wallet_checker/main.py
import asyncio
import os
from checkers.evm_checker import EVMChecker
from checkers.btc_checker import BTCChecker
from checkers.sol_checker import SolChecker
from checkers.sui_checker import SUIChecker
from core.engine import Engine

def print_engine_status(status):
    print(
        f"{status['chain'].upper()} | "
        f"Processed: {status['processed']} | "
        f"Active: {status['active']} | "
        f"Inactive: {status['inactive']} | "
        f"Retries: {status['retries']}"
    )
    for rpc in status["rpc_status"]:
        print(f"   RPC: {rpc['url']} -> {rpc['state']}")

async def dashboard(engines):
    while True:
        os.system('clear')
        print(f"===== EVM Chains =====")
        for e in engines:
            if e.chain.lower() in ["eth","bsc","pol","base","arbitrum","avalanche","gnosis"]:
                s = e.status()
                print_engine_status(s)

        print(f"\n=== Other Chains ===")
        for e in engines:
            if e.chain.lower() in ["btc","sol","sui"]:
                s = e.status()
                print_engine_status(s)

        active_total = sum(e.active for e in engines)
        inactive_total = sum(e.inactive for e in engines)
        print(f"\n=== TOTAL ===\nACTIVE ADDYS: {active_total}\nINACTIVE ADDYS: {inactive_total}")
        await asyncio.sleep(2)

async def main():
    engines = [
        Engine(EVMChecker, "rpcs/eth.txt", "data/evm_input.txt", "output/active.txt", "output/inactive_evm.txt", "ETH"),
        Engine(EVMChecker, "rpcs/bsc.txt", "data/evm_input.txt", "output/active.txt", "output/inactive_evm.txt", "BSC"),
        Engine(EVMChecker, "rpcs/polygon.txt", "data/evm_input.txt", "output/active.txt", "output/inactive_evm.txt", "POL"),
        Engine(EVMChecker, "rpcs/base.txt", "data/evm_input.txt", "output/active.txt", "output/inactive_evm.txt", "BASE"),
        Engine(EVMChecker, "rpcs/arbitrum.txt", "data/evm_input.txt", "output/active.txt", "output/inactive_evm.txt", "ARBITRUM"),
        Engine(EVMChecker, "rpcs/avalanche.txt", "data/evm_input.txt", "output/active.txt", "output/inactive_evm.txt", "AVALANCHE"),
        Engine(EVMChecker, "rpcs/gnosis.txt", "data/evm_input.txt", "output/active.txt", "output/inactive_evm.txt", "GNOSIS"),
        Engine(BTCChecker, "rpcs/btc.txt", "data/btc_input.txt", "output/active.txt", "output/inactive_btc.txt", "BTC"),
        Engine(SolChecker, "rpcs/sol.txt", "data/sol_input.txt", "output/active.txt", "output/inactive_sol.txt", "SOL"),
        Engine(SUIChecker, "rpcs/sui.txt", "data/sui_input.txt", "output/active.txt", "output/inactive_sui.txt", "SUI"),
    ]
    await asyncio.gather(*(e.run() for e in engines), dashboard(engines))

if __name__ == "__main__":
    asyncio.run(main())