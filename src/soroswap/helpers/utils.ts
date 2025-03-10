import base32 from "base32.js";

export function encodeContract(hexString: string): string {
  if (hexString === null || hexString === undefined) {
    throw new Error("cannot encode null data");
  }

  const versionByteName = "contract";
  const versionBytes = {
    contract: 2 << 3,
  };

  const versionByte = versionBytes[versionByteName];

  if (versionByte === undefined) {
    throw new Error(
      `${versionByteName} is not a valid version byte name. ` +
        `Expected one of ${Object.keys(versionBytes).join(", ")}`
    );
  }

  const data = Buffer.from(hexString, "hex");
  const versionBuffer = Buffer.from([versionByte]);
  const payload = Buffer.concat([versionBuffer, data]);
  const checksum = Buffer.from(calculateChecksum(payload));
  const unencoded = Buffer.concat([payload, checksum]);

  return base32.encode(unencoded);
}

function calculateChecksum(payload: Buffer): Uint8Array {
  let crc = 0x0000;
  const polynomial = 0x1021;

  for (let index = 0; index < payload.length; index++) {
    let byte = payload[index];
    for (let i = 0; i < 8; i++) {
      const bit = ((byte >> (7 - i)) & 1) === 1;
      const c15 = ((crc >> 15) & 1) === 1;
      crc <<= 1;
      if (c15 !== bit) {
        crc ^= polynomial;
      }
    }
  }

  crc &= 0xffff;
  return new Uint8Array([crc & 0xff, (crc >> 8) & 0xff]);
}
