import { StrKey } from "@stellar/stellar-sdk";

export function hexToSorobanAddress(hexString: string): string {
  const buffer = Buffer.from(hexString, "hex");
  return StrKey.encodeContract(buffer);
}
