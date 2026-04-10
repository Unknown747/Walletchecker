import asyncio
import aiohttp
from core.rpc_manager import RPCManager


class Engine:
    def __init__(self, checker_class, rpc_file, input_file, active_file, inactive_file, chain):
        self.checker_class = checker_class
        self.rpc_file = rpc_file
        self.input_file = input_file
        self.active_file = active_file
        self.inactive_file = inactive_file
        self.chain = chain

        self.addresses = self.load_addresses()
        self.processed = 0
        self.active = 0
        self.inactive = 0
        self.retries = 0

        self.rpc_manager = self.build_rpc_manager()
        self.checker = checker_class(self.rpc_manager)

    def load_addresses(self):
        try:
            with open(self.input_file, "r") as f:
                return [line.strip() for line in f if line.strip()]
        except:
            return []

    def build_rpc_manager(self):
        entries = []

        try:
            with open(self.rpc_file, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue

                    if "|" in line:
                        mode, url = line.split("|", 1)
                        entries.append({
                            "mode": mode.strip(),
                            "url": url.strip()
                        })
        except:
            pass

        return RPCManager(entries)

    async def worker(self, session, address):
        try:
            result = await self.checker.check(session, address)

            self.processed += 1

            if result:
                self.active += 1
                with open(self.active_file, "a") as f:
                    f.write(address + "\n")
            else:
                self.inactive += 1
                with open(self.inactive_file, "a") as f:
                    f.write(address + "\n")

        except:
            self.retries += 1

    async def run(self):
        connector = aiohttp.TCPConnector(limit=100)
        timeout = aiohttp.ClientTimeout(total=15)

        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            tasks = []

            for address in self.addresses:
                tasks.append(self.worker(session, address))

                if len(tasks) >= 100:
                    await asyncio.gather(*tasks)
                    tasks = []

            if tasks:
                await asyncio.gather(*tasks)

    def status(self):
        return {
            "chain": self.chain,
            "processed": self.processed,
            "active": self.active,
            "inactive": self.inactive,
            "retries": self.retries
        }
