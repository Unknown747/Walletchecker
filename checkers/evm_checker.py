import asyncio

class EVMChecker:
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
                "method": "eth_getBalance",
                "params": [address, "latest"],
                "id": 1
            }

            try:
                async with session.post(url, json=payload, timeout=10) as r:
                    if r.status != 200:
                        continue

                    data = await r.json()
                    result = data.get("result")

                    if result:
                        balance = int(result, 16)
                        return balance > 0

            except:
                continue

        return False