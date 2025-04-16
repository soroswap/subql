interface ReservesResult {
  reserveA: bigint;
  reserveB: bigint;
}

export const extractReserves = (event: any): ReservesResult => {
  let reserveA = BigInt(0);
  let reserveB = BigInt(0);

  const values = event?.value?._value;
  if (!Array.isArray(values)) {
    return { reserveA, reserveB };
  }

  for (const entry of values) {
    const keyBuffer = entry?._attributes?.key?._value?.data;
    const value = entry?._attributes?.val?._value?._attributes?.lo?._value;

    if (!keyBuffer || !value) {
      logger.info("❌ Missing keyBuffer or value");
      continue;
    }

    const keyText = Buffer.from(keyBuffer).toString();
    if (keyText === "new_reserve_0") {
      reserveA = BigInt(value);
    } else if (keyText === "new_reserve_1") {
      reserveB = BigInt(value);
    }
  }

  return { reserveA, reserveB };
};
