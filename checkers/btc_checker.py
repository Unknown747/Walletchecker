import asyncio

async def check_rest(session, address, url):
    try:
        async with session.get(url + address, timeout=10) as r:
            if r.status != 200:
                return None

            data = await r.json()

            if "chain_stats" in data:
                return data["chain_stats"].get("tx_count", 0) > 0

            elif "txs" in data:
                return len(data["txs"]) > 0

            elif "tx_count" in data:
                return data["tx_count"] > 0

    except:
        return None

    return False


async def check_rpc(session, address, url):
    try:
        payload = {
            "jsonrpc": "1.0",
            "id": "scan",
            "method": "getreceivedbyaddress",
            "params": [address]
        }

        async with session.post(url, json=payload, timeout=10) as r:
            if r.status != 200:
                return None

            data = await r.json()

            if isinstance(data.get("result"), (int, float)):
                return data["result"] > 0

    except:
        return None

    return False


class BTCChecker:
    def __init__(self, rpc_manager):
        self.rpc_manager = rpc_manager

    async def check(self, session, address):
        for _ in range(len(self.rpc_manager.rpcs)):
            entry = self.rpc_manager.get()

            if not entry:
                return False

            url = entry["url"]
            mode = entry.get("mode", "RPC")

            if mode == "REST":
                result = await check_rest(session, address, url)
            else:
                result = await check_rpc(session, address, url)

            if result is True:
                return True

        return False