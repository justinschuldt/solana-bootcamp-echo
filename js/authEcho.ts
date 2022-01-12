

import {
  Connection,
  sendAndConfirmTransaction,
  Keypair,
  Transaction,
  SystemProgram,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js"

import * as fs from "fs"
const { readFile } = fs.promises

const lastDeploy = require('../last-deploy.json');

const { programId: programAddress} = lastDeploy

import BN = require("bn.js")

const rpcUrl = "http://127.0.0.1:8899"
// const URL = "https://api.devnet.solana.com/"

const explorerLink = (txid: string): string => {
  let explorerCluster = "custom&customUrl=http://localhost:8899"
  if (rpcUrl.includes("devnet")) {
    explorerCluster = "devnet"
  }
  return `https://explorer.solana.com/tx/${txid}?cluster=${explorerCluster}`
}

const initialize = (authBuffer: PublicKey,  authority: PublicKey,  programId: PublicKey, buffer_seed: number, buffer_size: number) => {
  const idx = Buffer.from(new Uint8Array([1]));

  let seedSizeLen = Buffer.from(new Uint8Array((new BN(buffer_size)).toArray("le")))
  let seedBuf = new BN(buffer_seed).toBuffer()

  let bufferSizeLen = Buffer.from(new Uint8Array((new BN(buffer_seed)).toArray("le")))
  let sizeBuf = new BN(buffer_size).toBuffer()

  let i = new TransactionInstruction({
    keys: [
      {
        pubkey: authBuffer,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: authority,
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
    data: idx,
    programId: programId,
  });
  console.log(i)
  return i
};

const write = (authBuffer: PublicKey,  authority: PublicKey,  programId: PublicKey, message: string) => {
  const idx = Buffer.from(new Uint8Array([2]));
  const messageLen = Buffer.from(new Uint8Array((new BN(message.length)).toArray("le", 4)));
  const messageBuf = Buffer.from(message, "ascii");
  
  return new TransactionInstruction({
    keys: [
      {
        pubkey: authBuffer,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: authority,
        isSigner: true,
        isWritable: false,
      },
    ],
    data: Buffer.concat([idx, messageLen, messageBuf]),
    programId: programId,
  });
};
const second = async (connection: Connection, programId: PublicKey, authBuffer: PublicKey, feePayer: Keypair, authorized: Keypair, message: string): Promise<string> => {

  let tx = new Transaction();
  let signers = [feePayer, authorized]
  const writeInstruction = write(
    authBuffer,
    authorized.publicKey,
    programId,
    message
  )
  tx.add(writeInstruction);
  let txid = undefined
  try {
    txid = await sendAndConfirmTransaction(
      connection,
      tx,
      signers,
      {
        skipPreflight: true,
        preflightCommitment: "confirmed",
        commitment: "confirmed",
      }
    );

  } catch (error) {
    console.error(error)
    throw error
  }
  return txid
}

const main = async () => {
  var args = process.argv.slice(2);
  // const programId = new PublicKey(args[0]);
  const echo = args[0];
  const programId = new PublicKey(programAddress);
  console.log('programId', programId.toBase58())

  const buffer_seed = 123456
  const buffer_size = 124

  const connection = new Connection(rpcUrl);

  const feePayer = new Keypair();
  console.log("feePayer pubKey:", feePayer.publicKey.toBase58())

  const authorized = new Keypair();
  console.log("authorized pubKey:", authorized.publicKey.toBase58())

  // use authorized account from local filesystem keypair
  // let secretKeyString = await readFile('./auth-keypair.json',  "utf8",);
  // console.log("Loaded Keypair from ./auth-keypair.json");
  // const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  // const authorized = Keypair.fromSecretKey(secretKey);
  // console.log("authorized pubKey:", authorized.publicKey.toBase58())

  // const auth = PublicKey.createWithSeed(
  //   authorized.publicKey,
  //   String(buffer_seed),
  //   programId
  // )

  // let authBuffer = await PublicKey.createProgramAddress(
  //   [
  //     Buffer.from(`authority`, "ascii"),
  //     authorized.publicKey.toBuffer(),
  //     new Uint8Array(new BN(buffer_seed).toArray("le", 4))
  // ],
  // programId
  // )
  
  console.log("authority ", Buffer.from(`authority`))
  console.log("authorized.publicKey.toBuffer() ", authorized.publicKey.toBuffer())
  console.log("new Uint8Array((new BN(buffer_seed)).toArray('le'))", new Uint8Array((new BN(buffer_seed)).toArray("le", 8)))
  let [authBuffer, bump_seed] = await PublicKey.findProgramAddress(
    [
        Buffer.from(`authority`),
        authorized.publicKey.toBuffer(),
        // new BN(buffer_seed).toBuffer(),
        new Uint8Array(new BN(buffer_seed).toArray("le", 8))
    ],
    programId
  )
  console.log("authBuffer pubKey:", authBuffer.toBase58())
  console.log('bump_seed', bump_seed)

  console.log("Requesting Airdrop of 1 SOL for feePayer");
  await connection.requestAirdrop(feePayer.publicKey, 2e9);
  console.log("Requesting Airdrop of 1 SOL for authorized");
  await connection.requestAirdrop(authorized.publicKey, 2e9);
  console.log("Airdrops received");


  let tx = new Transaction();

  // let createIx = SystemProgram.createAccount({
  //   fromPubkey: authorized.publicKey,  // feepayer
  //   newAccountPubkey: authBuffer,      // 
  //   /** Amount of lamports to transfer to the created account */
  //   lamports: await connection.getMinimumBalanceForRentExemption(buffer_size),
  //   /** Amount of space in bytes to allocate to the created account */
  //   space: buffer_size,
  //   /** Public key of the program to assign as the owner of the created account */
  //   programId: programId,
  // });
  // tx.add(createIx)

  // const authKey = (await PublicKey.findProgramAddress(
  //   [echoBuffer.publicKey.toBuffer()],
  //   programId
  // ))[0];

  // const authBufferKey = (await PublicKey.findProgramAddress(
  //   [feePayer.publicKey.toBuffer(), echoBuffer.publicKey.toBuffer()],
  //   programId
  // ))[0];
  let signers = [feePayer, authorized]

  let authBuffData = await connection.getAccountInfo(authBuffer)
  if (!authBuffData) {
    console.log("no authBuffer account found, going to initialize");
    const initializeIx = initialize(
      authBuffer,
      authorized.publicKey,
      programId,
      buffer_seed,
      buffer_size,
    );
    tx.add(initializeIx);
  }

  console.log("Writing message from the authorized account");
  const writeInstruction = write(
    authBuffer,
    authorized.publicKey, // authKey,
    programId,
    echo
  )
  tx.add(writeInstruction);
  signers.push(authorized)

  // const idx = Buffer.from(new Uint8Array([0]));
  // const messageLen = Buffer.from(new Uint8Array((new BN(echo.length)).toArray("le", 4)));
  // const message = Buffer.from(echo, "ascii");

  // let echoIx = new TransactionInstruction({
  //   keys: [
  //     {
  //       pubkey: echoBuffer.publicKey,
  //       isSigner: false,
  //       isWritable: true,
  //     },
  //   ],
  //   programId: programId,
  //   data: Buffer.concat([idx, messageLen, message]),
  // });
  // tx.add(echoIx);

let txid = undefined
  try {
    txid = await sendAndConfirmTransaction(
      connection,
      tx,
      signers,
      {
        skipPreflight: true,
        preflightCommitment: "confirmed",
        commitment: "confirmed",
      }
    );

  } catch (error) {
    console.error(error)
    throw error
  }

  console.log("first write", explorerLink(txid))

  setTimeout(async ()=> {
    const getEchoData = async (connection: Connection, account: PublicKey): Promise<string> => {
      let data = (await connection.getAccountInfo(authBuffer, "confirmed") || {}).data
      // console.log("Echo Buffer Text:", data?.slice(9).toString());
      return data?.slice(9).toString() || ""
    }
    const firstWriteData = await getEchoData(connection, authBuffer)
    console.log("first write data: ", firstWriteData)
    try {
      // should succeed
      let txid = await second(connection, programId, authBuffer, feePayer, authorized, "second write worked!")
      console.log("second write", explorerLink(txid))
      setTimeout(async () => {
        const writeData = await getEchoData(connection, authBuffer)
        console.log("second write data: ", writeData)
      }, 4000)
    } catch {

    }
    try {
      // should fail
      let txid = await second(connection, programId, authBuffer, feePayer, feePayer, "this should fail")
      console.log("failed write", explorerLink(txid))
    } catch(error) {
      console.log("third write err", error)
      setTimeout(async () => {
        const writeData = await getEchoData(connection, authBuffer)
        console.log("third write data: ", writeData)
      }, 4000)
    }

  },6000)
};

main()
  .then(() => {
    console.log("Success");
  })
  .catch((e) => {
    console.error(e);
  });
