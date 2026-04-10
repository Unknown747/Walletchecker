# wallet_checker/main.py
import asyncio
import os
from checkers.evm_checker import EVMChecker
from checkers.btc_checker import BTCChecker
from checkers.sol_checker import SolChecker
from checkers.sui_checker import SUIChecker
from core.engine import Engine

async def dashboard(engines):
    while True:
        os.system('clear')  # Windows use 'cls'
        print(f"===== EVM Chains =====")
        for e in engines:
            if e.chain.lower() in ["eth","bsc","polygon","base","arbitrum","avalanche","gnosis"]:
                s = e.status()
                print(f"{s['chain'].upper()} | Queue: {print(
                f"{s['chain']} | "
                f"Processed: {s['processed']} | "
                f"Active: {s['active']} | "
                f"Inactive: {s['inactive']} | "
                f"Retries: {s['retries']}"
                )} | Processed: {s['processed']} | Active: {s['active']} | Inactive: {s['inactive']} | Retries: {s['retries']}")
                for r in s['rpc_status']:
                    print(f"   RPC: {r['url']} -> {r['state']}")

        print(f"\n=== Other Chains ===")
        for e in engines:
            if e.chain.lower() in ["btc","sol","sui"]:
                s = e.status()
                print(f"{s['chain'].upper()} | Queue: {print(
                f"{s['chain']} | "
                f"Processed: {s['processed']} | "
                f"Active: {s['active']} | "
                f"Inactive: {s['inactive']} | "
                f"Retries: {s['retries']}"
                )} | Processed: {s['processed']} | Active: {s['active']} | Inactive: {s['inactive']} | Retries: {s['retries']}")
                for r in s['rpc_status']:
                    print(f"   RPC: {r['url']} -> {r['state']}")

        active_total = sum(e.active_count for e in engines)
        inactive_total = sum(e.inactive_count for e in engines)
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