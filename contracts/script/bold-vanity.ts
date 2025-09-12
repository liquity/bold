import assert from "assert";

import {
  type ByteArray,
  bytesToHex,
  concatBytes,
  getAddress,
  hexToBytes,
  keccak256,
  padBytes,
  stringToBytes,
} from "viem";

import BoldToken from "../out/BoldToken.sol/BoldToken.json";

const DEPLOYER = "0xbEC25C5590e89596BDE2DfCdc71579E66858772c";
const SALT_PREFIX = "beBOLD";
const CREATE2_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const CREATE2_PREFIX = concatBytes([hexToBytes("0xFF"), hexToBytes(CREATE2_DEPLOYER)]);

const computeCreate2Address = (salt: ByteArray, initCodeHash: ByteArray): ByteArray =>
  keccak256(concatBytes([CREATE2_PREFIX, salt, initCodeHash]), "bytes").slice(12);

const startsWith = <T extends string>(str: string, prefix: T): str is `${T}${string}` => str.startsWith(prefix);
assert(startsWith(BoldToken.bytecode.object, "0x"));

const boldInitCodeHash = keccak256(
  concatBytes([
    hexToBytes(BoldToken.bytecode.object),
    padBytes(hexToBytes(DEPLOYER)),
  ]),
  "bytes",
);

for (let i = 0;; ++i) {
  const saltStr = `${SALT_PREFIX}${i}`;
  const salt = keccak256(stringToBytes(saltStr), "bytes");
  const boldAddress = computeCreate2Address(salt, boldInitCodeHash);

  if (boldAddress[0] === 0xb0 && boldAddress[1] === 0x1d /*&& boldAddress[18] === 0xb0 && boldAddress[19] === 0x1d*/) {
    console.log("Salt found:", saltStr);
    console.log("BOLD address:", getAddress(bytesToHex(boldAddress)));
    break;
  }
}
