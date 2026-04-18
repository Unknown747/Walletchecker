# Wallet Checker System

Multi-chain scanner (EVM + BTC + SOL + SUI)

## Generate Wallets and Run Scanner

```bash
node main.js --count=10
```

`node main.js` automatically creates new wallets, updates scanner input files in `data/`, clears old scan output, and starts the checker dashboard.

## Generate Wallets Only

```bash
node generateWallets.js --count=10
```

This creates new wallets for EVM, BTC, SOL, and SUI without starting the checker dashboard.

## Run Scanner

```bash
node main.js
```

