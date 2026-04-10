import time
import sys

class LiveLogger:
    def __init__(self):
        self.stats = {
            "active": 0,
            "inactive": 0,
            "evm": "IDLE",
            "btc": "IDLE",
            "sol": "IDLE",
            "sui": "IDLE"
        }

    def update(self, key, value):
        self.stats[key] = value

    def increment(self, key):
        self.stats[key] += 1

    def display(self):
        sys.stdout.write("\033[2J\033[H")  # clear screen

        print("==== EVM CHAINS ====")
        print(f"Status: {self.stats['evm']}")

        print("\n=== OTHER CHAINS ===")
        print(f"BTC: {self.stats['btc']}")
        print(f"SOL: {self.stats['sol']}")
        print(f"SUI: {self.stats['sui']}")

        print("\n=== TOTAL ===")
        print(f"ACTIVE: {self.stats['active']}")
        print(f"INACTIVE: {self.stats['inactive']}")

        time.sleep(0.5)