# Wallet Checker System

## Overview
This is a JavaScript console application for generating wallet addresses and checking wallet activity across EVM, BTC, SOL, and SUI chains.

## Project Structure
- `main.js` generates new wallets, updates scanner input files, clears old output, then starts the scanner dashboard.
- `generateWallets.js` can also be run directly to generate new EVM, BTC, SOL, and SUI wallets without starting the scanner.
- `checkers/` contains chain-specific JavaScript balance/activity checkers.
- `core/` contains the JavaScript scan engine and RPC rotation logic.
- `data/` is expected to contain wallet input files.
- `rpcs/` is expected to contain RPC endpoint files.
- `output/active.txt` stores only wallets with detected balance using `CHAIN,address` rows; empty wallets are not saved.
- `wallets/` stores generated wallet private key/secret data and must be kept private.

## Runtime
- Node.js 20
- Wallet generation uses `ethers`, `bitcoinjs-lib`, `ecpair`, `tiny-secp256k1`, `@solana/web3.js`, `@mysten/sui`, and `bs58`.
- Replit workflow runs `node main.js` as a console process.

## Notes
- The imported project is a console tool, not a web frontend.
- Missing input or RPC files are handled as empty lists so the dashboard can still run.
- Python source files from the import were removed; the active runtime is JavaScript.
- Run `node main.js --count=10` to generate wallets and immediately start checking them.
- Run `node generateWallets.js --count=10` to only create wallets and refresh scanner input files.
- Empty wallets are counted in the dashboard as inactive but are intentionally not written to output files.