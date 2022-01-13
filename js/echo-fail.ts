

import {
  Connection,
  sendAndConfirmTransaction,
  Keypair,
  Transaction,
  SystemProgram,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js"

const lastDeploy = require('../last-deploy.json');

const { programId: programAddress} = lastDeploy

import BN = require("bn.js");

const rpcUrl = "http://127.0.0.1:8899"
// const rpcUrl = "https://api.devnet.solana.com/"

const main = async () => {
  var args = process.argv.slice(2);
  // const programId = new PublicKey(args[0]);
  const echo = args[0];
  console.log('address', programAddress)
  const programId = new PublicKey(programAddress);

  const connection = new Connection(rpcUrl);

  const feePayer = new Keypair();
  const echoBuffer = new Keypair();

  console.log("Requesting Airdrop of 1 SOL...");
  await connection.requestAirdrop(feePayer.publicKey, 2e9);
  console.log("Airdrop received");

  console.log("going to echo message: ", echo)
  let tx = new Transaction();

  const idx = Buffer.from(new Uint8Array([0]));
  const messageLen = Buffer.from(new Uint8Array((new BN(echo.length)).toArray("le", 4)));
  const message = Buffer.from(echo, "ascii");

  let echoIx = new TransactionInstruction({
    keys: [
      {
        pubkey: echoBuffer.publicKey,
        isSigner: false,
        isWritable: true,
      },
    ],
    programId: programId,
    data: Buffer.concat([idx, messageLen, message]),
  });

  tx.add(echoIx);

  let txid = undefined
  try {
    txid = await sendAndConfirmTransaction(
      connection,
      tx,
      [feePayer, echoBuffer],
      {
        skipPreflight: true,
        preflightCommitment: "confirmed",
        commitment: "confirmed",
      }
    );

  } catch (error) {
    console.log(error)
  }
  let explorerCluster = "custom&customUrl=http://localhost:8899"
  if (rpcUrl.includes("devnet")) {
    explorerCluster = "devnet"
  }
  console.log(`https://explorer.solana.com/tx/${txid}?cluster=${explorerCluster}`);

  let data = (await connection.getAccountInfo(echoBuffer.publicKey) || {}).data;
  console.log("Echo Buffer Text:", data?.toString());

};

main()
  .then(() => {
    console.log("Success");
  })
  .catch((e) => {
    console.error(e);
  });
