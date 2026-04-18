# Wallet Checker System

Multi-chain scanner (EVM + BTC + SOL + SUI)

## Generate Wallets

```bash
node generateWallets.js --count=10
```

This creates new wallets for EVM, BTC, SOL, and SUI, updates the scanner input files in `data/`, clears old scan output, and stores private key/secret details in `wallets/`.

## Run Scanner

```bash
node main.js
```

