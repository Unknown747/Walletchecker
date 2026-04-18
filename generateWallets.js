const fs = require("fs");
const { HDNodeWallet } = require("ethers");
const bitcoin = require("bitcoinjs-lib");
const ecc = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");
const { BIP32Factory } = require("bip32");
const { Keypair } = require("@solana/web3.js");
const bip39 = require("bip39");
const { derivePath } = require("ed25519-hd-key");

const bip32 = BIP32Factory(ecc);
ECPairFactory(ecc);

const EVM_PATH = "m/44'/60'/0'/0/0";
const BTC_PATH = "m/44'/0'/0'/0/0";
const SOL_PATH = "m/44'/501'/0'/0'";
const SUI_PATH = "m/44'/784'/0'/0'/0'";

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
  for (const file of ["data/evm_input.txt", "data/btc_input.txt", "data/sol_input.txt", "data/sui_input.txt"]) {
    fs.writeFileSync(file, "");
  }
}

function writeLines(filePath, lines) {
  fs.writeFileSync(filePath, lines.length ? `${lines.join("\n")}\n` : "");
}

function generateSeedWallet(Ed25519Keypair) {
  const mnemonic = bip39.generateMnemonic();
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const seedHex = seed.toString("hex");

  const evmNode = HDNodeWallet.fromPhrase(mnemonic, undefined, EVM_PATH);

  const btcChild = bip32.fromSeed(seed).derivePath(BTC_PATH);
  const { address: btcAddress } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(btcChild.publicKey)
  });

  const { key: solKey } = derivePath(SOL_PATH, seedHex);
  const solKeypair = Keypair.fromSeed(solKey);

  const suiKeypair = Ed25519Keypair.deriveKeypair(mnemonic, SUI_PATH);

  return {
    mnemonic,
    evm: evmNode.address,
    btc: btcAddress,
    sol: solKeypair.publicKey.toBase58(),
    sui: suiKeypair.getPublicKey().toSuiAddress(),
    evmPrivateKey: evmNode.privateKey,
    btcPrivateKeyWif: btcChild.toWIF(),
    solSecretKey: Buffer.from(solKeypair.secretKey).toString("hex"),
    suiSecretKey: suiKeypair.getSecretKey()
  };
}

async function generateWallets(options = {}) {
  const count = options.count || parseCount(options.args);

  const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");

  ensureDirectories();
  clearInputFiles();

  const wallets = [];

  for (let i = 0; i < count; i += 1) {
    wallets.push(generateSeedWallet(Ed25519Keypair));
  }

  writeLines("data/evm_input.txt", wallets.map((w) => w.evm));
  writeLines("data/btc_input.txt", wallets.map((w) => w.btc));
  writeLines("data/sol_input.txt", wallets.map((w) => w.sol));
  writeLines("data/sui_input.txt", wallets.map((w) => w.sui));

  return { count, wallets };
}

if (require.main === module) {
  generateWallets()
    .then(({ count }) => {
      console.log(`Generated ${count} seed wallets (all chains). Addresses saved to data/.`);
    })
    .catch((error) => {
      console.error(error.message || error);
      process.exit(1);
    });
}

module.exports = { generateWallets, parseCount };
