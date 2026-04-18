# Wallet Checker System

## Overview
This is a JavaScript console application for generating wallet addresses and checking wallet activity across EVM, BTC, SOL, and SUI chains.

## Project Structure
- `main.js` starts the scanner and live console dashboard.
- `generateWallets.js` generates new EVM, BTC, SOL, and SUI wallets.
- `checkers/` contains chain-specific JavaScript balance/activity checkers.
- `core/` contains the JavaScript scan engine and RPC rotation logic.
- `data/` is expected to contain wallet input files.
- `rpcs/` is expected to contain RPC endpoint files.
- `output/` receives active and inactive wallet results.
- `wallets/` stores generated wallet private key/secret data and must be kept private.

## Runtime
- Node.js 20
- Wallet generation uses `ethers`, `bitcoinjs-lib`, `ecpair`, `tiny-secp256k1`, `@solana/web3.js`, `@mysten/sui`, and `bs58`.
- Replit workflow runs `node main.js` as a console process.

## Notes
- The imported project is a console tool, not a web frontend.
- Missing input or RPC files are handled as empty lists so the dashboard can still run.
- Python source files from the import were removed; the active runtime is JavaScript.
- Run `node generateWallets.js --count=10` to create wallets and refresh scanner input files.