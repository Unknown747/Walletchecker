# Wallet Checker System

## Overview
This is a JavaScript console application for checking wallet activity across EVM, BTC, SOL, and SUI chains.

## Project Structure
- `main.js` starts the scanner and live console dashboard.
- `checkers/` contains chain-specific JavaScript balance/activity checkers.
- `core/` contains the JavaScript scan engine and RPC rotation logic.
- `data/` is expected to contain wallet input files.
- `rpcs/` is expected to contain RPC endpoint files.
- `output/` receives active and inactive wallet results.

## Runtime
- Node.js 20
- No external npm packages are required; the app uses Node's built-in `fetch`.
- Replit workflow runs `node main.js` as a console process.

## Notes
- The imported project is a console tool, not a web frontend.
- Missing input or RPC files are handled as empty lists so the dashboard can still run.
- Python source files from the import are retained, but the active runtime is JavaScript.