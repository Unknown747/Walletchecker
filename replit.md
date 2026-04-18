# Wallet Checker System

## Overview
This is a Python console application for checking wallet activity across EVM, BTC, SOL, and SUI chains.

## Project Structure
- `main.py` starts the scanner and live console dashboard.
- `checkers/` contains chain-specific balance/activity checkers.
- `core/` contains the scan engine and RPC rotation logic.
- `data/` is expected to contain wallet input files.
- `rpcs/` is expected to contain RPC endpoint files.
- `output/` receives active and inactive wallet results.

## Runtime
- Python 3.12
- Dependencies are declared in `requirements.txt`.
- Replit workflow runs `python main.py` as a console process.

## Notes
- The imported project is a console tool, not a web frontend.
- Missing input or RPC files are handled as empty lists so the dashboard can still run.