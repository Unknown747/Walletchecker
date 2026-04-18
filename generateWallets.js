const fs = require("fs");
const path = require("path");
const { Wallet } = require("ethers");
const bitcoin = require("bitcoinjs-lib");
const ecc = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");
const { Keypair } = require("@solana/web3.js");

const ECPair = ECPairFactory(ecc);

function getBs58Encoder(bs58Module) {
  return bs58Module.default || bs58Module;
}

function parseCount() {
  const countArg = process.argv.find((arg) => arg.startsWith("--count="));
  const rawCount = countArg ? countArg.split("=")[1] : process.argv[2];
  const count = Number.parseInt(rawCount || "10", 10);

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("Jumlah wallet harus angka lebih dari 0. Contoh: node generateWallets.js --count=10");
  }

  return count;
}

function ensureDirectories() {
  for (const directory of ["data", "output", "wallets"]) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function clearOldScannerFiles() {
  const files = [
    "data/evm_input.txt",
    "data/btc_input.txt",
    "data/sol_input.txt",
    "data/sui_input.txt",
    "output/active.txt",
    "output/inactive_evm.txt",
    "output/inactive_btc.txt",
    "output/inactive_sol.txt",
    "output/inactive_sui.txt",
    "output/results.csv"
  ];

  for (const file of files) {
    fs.writeFileSync(file, "");
  }
}

function writeLines(filePath, lines) {
  fs.writeFileSync(filePath, `${lines.join("\n")}${lines.length ? "\n" : ""}`);
}

function generateEvmWallet() {
  const wallet = Wallet.createRandom();

  return {
    chain: "EVM",
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase || null
  };
}

function generateBtcWallet() {
  const keyPair = ECPair.makeRandom({ network: bitcoin.networks.bitcoin });
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(keyPair.publicKey),
    network: bitcoin.networks.bitcoin
  });

  return {
    chain: "BTC",
    address,
    privateKeyWif: keyPair.toWIF()
  };
}

function generateSolWallet(bs58) {
  const keyPair = Keypair.generate();

  return {
    chain: "SOL",
    address: keyPair.publicKey.toBase58(),
    secretKey: bs58.encode(keyPair.secretKey)
  };
}

async function generateSuiWallet() {
  const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");
  const keyPair = new Ed25519Keypair();

  return {
    chain: "SUI",
    address: keyPair.getPublicKey().toSuiAddress(),
    secretKey: keyPair.getSecretKey()
  };
}

async function main() {
  const count = parseCount();
  const bs58 = getBs58Encoder(await import("bs58"));

  ensureDirectories();
  clearOldScannerFiles();

  const evmWallets = [];
  const btcWallets = [];
  const solWallets = [];
  const suiWallets = [];

  for (let index = 0; index < count; index += 1) {
    evmWallets.push(generateEvmWallet());
    btcWallets.push(generateBtcWallet());
    solWallets.push(generateSolWallet(bs58));
    suiWallets.push(await generateSuiWallet());
  }

  writeLines("data/evm_input.txt", evmWallets.map((wallet) => wallet.address));
  writeLines("data/btc_input.txt", btcWallets.map((wallet) => wallet.address));
  writeLines("data/sol_input.txt", solWallets.map((wallet) => wallet.address));
  writeLines("data/sui_input.txt", suiWallets.map((wallet) => wallet.address));

  const generatedAt = new Date().toISOString();
  const keyFile = path.join("wallets", `generated-wallets-${generatedAt.replace(/[:.]/g, "-")}.json`);
  const latestKeyFile = path.join("wallets", "latest-generated-wallets.json");
  const payload = {
    generatedAt,
    count,
    warning: "Simpan file ini dengan aman. Private key/secret key memberi akses penuh ke wallet.",
    wallets: {
      evm: evmWallets,
      btc: btcWallets,
      sol: solWallets,
      sui: suiWallets
    }
  };

  fs.writeFileSync(keyFile, JSON.stringify(payload, null, 2));
  fs.writeFileSync(latestKeyFile, JSON.stringify(payload, null, 2));

  console.log(`Generated ${count} wallet untuk EVM, BTC, SOL, dan SUI.`);
  console.log("Address scanner diperbarui di folder data/.");
  console.log(`Private key/secret tersimpan di ${keyFile}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});