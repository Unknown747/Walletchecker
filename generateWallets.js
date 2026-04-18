const fs = require("fs");
const path = require("path");
const { Wallet } = require("ethers");
const bitcoin = require("bitcoinjs-lib");
const ecc = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");
const { Keypair } = require("@solana/web3.js");

const ECPair = ECPairFactory(ecc);

function parseCount(args = process.argv.slice(2)) {
  const countArg = args.find((arg) => arg.startsWith("--count="));
  const rawCount = countArg ? countArg.split("=")[1] : args.find((arg) => /^\d+$/.test(arg));
  const count = Number.parseInt(rawCount || "10", 10);

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("Jumlah wallet harus angka lebih dari 0. Contoh: node main.js --count=10");
  }

  return count;
}

function ensureDirectories() {
  for (const dir of ["data", "output"]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function clearInputFiles() {
  const files = [
    "data/evm_input.txt",
    "data/btc_input.txt",
    "data/sol_input.txt",
    "data/sui_input.txt"
  ];
  for (const file of files) {
    fs.writeFileSync(file, "");
  }
}

function writeLines(filePath, lines) {
  fs.writeFileSync(filePath, lines.length ? `${lines.join("\n")}\n` : "");
}

function generateEvmWallet() {
  const wallet = Wallet.createRandom();
  return {
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
  return { address, privateKeyWif: keyPair.toWIF() };
}

function generateSolWallet(bs58) {
  const keyPair = Keypair.generate();
  return {
    address: keyPair.publicKey.toBase58(),
    secretKey: bs58.encode(keyPair.secretKey)
  };
}

async function generateSuiWallet() {
  const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");
  const keyPair = new Ed25519Keypair();
  return {
    address: keyPair.getPublicKey().toSuiAddress(),
    secretKey: keyPair.getSecretKey()
  };
}

async function generateWallets(options = {}) {
  const count = options.count || parseCount(options.args);
  const bs58 = (await import("bs58")).default || (await import("bs58"));

  ensureDirectories();
  clearInputFiles();

  const evmWallets = [];
  const btcWallets = [];
  const solWallets = [];
  const suiWallets = [];

  for (let i = 0; i < count; i += 1) {
    evmWallets.push(generateEvmWallet());
    btcWallets.push(generateBtcWallet());
    solWallets.push(generateSolWallet(bs58));
    suiWallets.push(await generateSuiWallet());
  }

  writeLines("data/evm_input.txt", evmWallets.map((w) => w.address));
  writeLines("data/btc_input.txt", btcWallets.map((w) => w.address));
  writeLines("data/sol_input.txt", solWallets.map((w) => w.address));
  writeLines("data/sui_input.txt", suiWallets.map((w) => w.address));

  return { count, evmWallets, btcWallets, solWallets, suiWallets };
}

if (require.main === module) {
  generateWallets()
    .then(({ count }) => {
      console.log(`Generated ${count} wallets per chain. Addresses saved to data/.`);
    })
    .catch((error) => {
      console.error(error.message || error);
      process.exit(1);
    });
}

module.exports = { generateWallets, parseCount };
