import asyncio

class SolChecker:
    def __init__(self, rpc_manager):
        self.rpc_manager = rpc_manager

    async def check(self, session, address):
        for _ in range(len(self.rpc_manager.rpcs)):
            entry = self.rpc_manager.get()

            if not entry:
                return False

            url = entry["url"]

            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getBalance",
                "params": [address]
            }

            try:
                async with session.post(url, json=payload, timeout=10) as r:
                    if r.status != 200:
                        continue

                    data = await r.json()

                    if "result" in data and "value" in data["result"]:
                        balance = data["result"]["value"]
                        return balance > 0

            except:
                continue

        return False