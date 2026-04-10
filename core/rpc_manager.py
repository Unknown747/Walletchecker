class RPCManager:
    def __init__(self, rpc_entries):
        self.rpcs = rpc_entries
        self.index = 0
        self.fail_count = {}

        for i in range(len(rpc_entries)):
            self.fail_count[i] = 0

    def get(self):
        if not self.rpcs:
            return None

        entry = self.rpcs[self.index % len(self.rpcs)]
        self.index += 1
        return entry

    def mark_fail(self, entry):
        try:
            idx = self.rpcs.index(entry)
            self.fail_count[idx] += 1
        except:
            pass

    def mark_success(self, entry):
        try:
            idx = self.rpcs.index(entry)
            self.fail_count[idx] = 0
        except:
            pass