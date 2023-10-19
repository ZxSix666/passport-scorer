const { Pool } = require("pg");
const jwt = require("jsonwebtoken");

const pool = new Pool();

let dids = null;
let didtools = null;
let multiformats = null;
let KeyResolver = null;
let DID = null;
let Cacao = null;
let CID = null;
let isInitialized = false;
let Block = null;
let codec = null;
let hasherLib = null;
let hasher = null;
let base32 = null;
let base64 = null;
let fromString = null;
let toString = null;

const nonceQuery =
  "UPDATE account_nonce \
SET was_used=true \
WHERE nonce=$1 \
AND was_used=false \
";

async function load_libs() {
  dids = await import("dids");
  didtools = await import("@didtools/cacao");
  multiformats = await import("multiformats/cid");
  KeyResolver = await import("key-did-resolver");
  Block = await import("multiformats/block");
  codec = await import("@ipld/dag-cbor");
  hasherLib = await import("multiformats/hashes/sha2");
  let base64_bases = await import("multiformats/bases/base64");

  let fromStringModule = await import("uint8arrays/from-string");
  console.log("fromStringModule", fromStringModule);
  fromString = fromStringModule.fromString;
  console.log("fromString", fromString);

  let toStringModule = await import("uint8arrays/to-string");
  console.log("toStringModule", toStringModule);
  toString = toStringModule.toString;
  console.log("toString", toString);

  console.log("base64_bases", base64_bases);
  base64 = base64_bases.base64;
  hasher = hasherLib.sha256;
  DID = dids.DID;
  Cacao = didtools.Cacao;
  CID = multiformats.CID;
  base32 = multiformats.base32;
  isInitialized = true;
}

exports.handler = async (event, context) => {
  const awsRequestId = context.awsRequestId;
  console.log("=============================================================");
  console.log(" === event \n" + JSON.stringify(event, undefined, 2));
  console.log("=============================================================");
  const body = JSON.parse(event.body);
  console.log(" === body \n" + JSON.stringify(body, undefined, 2));
  console.log("=============================================================");
  console.log(" === context \n" + JSON.stringify(context, undefined, 2));
  console.log("=============================================================");

  function log() {
    console.log(`RequestID=${awsRequestId}`, ...arguments);
  }

  function err() {
    console.error(`RequestID=${awsRequestId}`, ...arguments);
  }

  if (!isInitialized) {
    await load_libs();
  }

  // Step 1: Validate nonce
  // - read the nonce from the body
  // - run a DB query that checks the the nonce has not been used and also set it as used
  const nonce = body.nonce;
  log(" === nonce " + nonce);
  //   const nonceVerificationResul = await pool.query(nonceQuery, [nonce]);

  //   log("res: ", nonceVerificationResul);
  //   if (nonceVerificationResul.rowCount > 0) {
  //     log("Num affected rows:", nonceVerificationResul.rowCount);
  //   } else {
  //     log("No affected rows. Returning: Invalid nonce or payload!");
  //     return {
  //       statusCode: 400,
  //       body: JSON.stringify({ detail: "Invalid nonce or payload!" }),
  //     };
  //   }

  // Step 2: Validate payload
  // Compute the CID, and make sure it is correct for the given nonce

  const block = await Block.encode({
    value: { nonce: nonce },
    codec,
    hasher,
  });
  const expectedCID = body.payload;
  const computedCID = toString(block.cid.bytes, "base64url");

  if (expectedCID != computedCID) {
    err("Invalid nonce or payload!");
    return {
      statusCode: 400,
      body: JSON.stringify({ detail: "Invalid nonce or payload!" }),
    };
  }

  // Step 3: Validate JWS
  const jws_restored = {
    signatures: body.signatures,
    payload: body.payload,
    cid: CID.decode(new Uint8Array(body.cid)),
  };

  const cacao = await Cacao.fromBlockBytes(new Uint8Array(body.cacao));

  const did = new DID({
    resolver: KeyResolver.getResolver(),
  });

  try {
    await did.verifyJWS(jws_restored, {
      issuer: body.issuer,
      capability: cacao,
      disableTimecheck: true,
    });
  } catch (error) {
    err("Verification failed:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({ status: "failed", error: error.toString() }),
    };
  }

  const secretKey = "some-secret-value";
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 7 * 24 * 60 * 60;
  const token = jwt.sign(
    {
      token_type: "access",
      jti: "6d6d5daa403343e8b2224a2055322bc0",
      did: body.issuer,
      iat,
      exp,
    },
    secretKey,
    { algorithm: "HS256" }
  );

  return {
    statusCode: 400,
    body: JSON.stringify({ access: token }),
  };
};

// Validate payload

// load_libs().then(async () => {
//   const expected_payload = "AXESIIVo4Lmvlkfun-p2u3Bu92F6p3goA3n_sTK67E8_n8GS";
//   console.log("Block", Block);
//   const nonce = "957c990fa32753e1550ea2766466f7f73aa0949f63812d87a13a452f5051";

//   const block = await Block.encode({
//     value: { nonce: nonce },
//     codec,
//     hasher,
//   });
//   const computedCID = toString(block.cid.bytes, "base64url");
//   console.log("Encoded block: ", block);
//   console.log("Encoded block cid: ", block.cid);

//   console.log("computedCID      :   ", computedCID);
//   console.log("expected_payload :   ", expected_payload);

//   // const expected_paylod_bytes = fromString(expected_payload, "base64url");
//   // console.log("expected_paylod_bytes: ", expected_paylod_bytes);
//   // const expected_cid = CID.decode(expected_paylod_bytes);
//   // console.log("expected_cid: ", expected_cid);

//   // const expectedCID = CID.parse(expected_payload, base64);
//   // console.log("expectedCID: ", expectedCID);
// });
