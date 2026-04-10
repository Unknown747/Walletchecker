class RPCManager:
    def __init__(self, rpc_entries):
        self.rpcs = rpc_entries
        self.index = 0

    def get(self):
        if not self.rpcs:
            return None
        entry = self.rpcs[self.index % len(self.rpcs)]
        self.index += 1
        return entry