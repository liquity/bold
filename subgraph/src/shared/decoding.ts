import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

export function decodeAddress(data: Bytes, i: i32 = 0): ethereum.Value {
  return ethereum.Value.fromAddress(
    Address.fromBytes(
      Bytes.fromUint8Array(
        data.subarray(i * 32 + 12, i * 32 + 32),
      ),
    ),
  );
}

export function decodeUint8(data: Bytes, i: i32 = 0): ethereum.Value {
  return ethereum.Value.fromI32(
    data[i * 32 + 31],
  );
}

export function decodeUint256(data: Bytes, i: i32 = 0): ethereum.Value {
  return ethereum.Value.fromUnsignedBigInt(
    BigInt.fromUnsignedBytes(
      Bytes.fromUint8Array(
        data.subarray(i * 32, i * 32 + 32).reverse(),
      ),
    ),
  );
}
