import { Contract, StrKey } from "@stellar/stellar-sdk";
import { xdr } from "@stellar/stellar-sdk";
import { hexToSorobanAddress } from "../../utils";

export function getTransactionData(
  event: any,
  contractId: string
): {
  tokenA?: string;
  tokenB?: string;
  tokenC?: string;
  reserveA?: bigint;
  reserveB?: bigint;
  reserveC?: bigint;
  fee?: bigint;
  futureA?: bigint;
  futureATime?: bigint;
  initialA?: bigint;
  initialATime?: bigint;
  precisionMulA?: bigint;
  precisionMulB?: bigint;
  precisionMulC?: bigint;
} {
  const resultMetaXdrString = event.transaction.result_meta_xdr;

  const txMeta = xdr.TransactionMeta.fromXDR(resultMetaXdrString, "base64");

  const txOperations = txMeta.v3().operations()[0].changes();

  const filteredOperations = txOperations.filter((operation) => {
    const switchName = operation?.["_switch"]?.name;
    const contractBuffer = operation?.value()?.data()?.["_value"]?._attributes
      ?.contract?._value;
    if (switchName === "ledgerEntryUpdated" && contractBuffer) {
      const contractData = JSON.parse(JSON.stringify(contractBuffer)).data;
      const contract = hexToSorobanAddress(
        Buffer.from(contractData).toString("hex")
      );
      return contract === contractId;
    }
    return false;
  });

  // Found the values of ReserveA, ReserveB and FeeFraction in the contract
  let tokenA: string | undefined;
  let tokenB: string | undefined;
  let tokenC: string | undefined;
  let reserveA: bigint | undefined;
  let reserveB: bigint | undefined;
  let reserveC: bigint | undefined;
  let fee: bigint | undefined;
  let reserves: any | undefined;
  let futureA: bigint | undefined;
  let futureATime: bigint | undefined;
  let initialA: bigint | undefined;
  let initialATime: bigint | undefined;
  let precisionMulA: bigint | undefined;
  let precisionMulB: bigint | undefined;
  let precisionMulC: bigint | undefined;
  
  // Search in the filtered operations
  for (const operation of filteredOperations) {
    // Verify if it is an update of the contract instance
    const val =
      operation?.["_value"]?._attributes?.data?._value?._attributes?.val;

    if (val?._switch?.name === "scvContractInstance") {
      // find data storage from contract instance
      const storage = val?.instance()?._attributes?.storage;

      if (storage && Array.isArray(storage)) {
        // Iterate over the storage to find the keys that we are interested in
        for (const item of storage) {
          const key = item?.key();
          const keyVec = key?.vec?.();

          if (keyVec && keyVec.length > 0) {
            const firstElement = keyVec[0];

            if (firstElement?.switch?.().name === "scvSymbol") {
              const symbolName = firstElement.sym().toString();
              const itemValue = item.val();

              // Extract the values according to the symbol name
              if (
                symbolName === "TokenA" &&
                itemValue?.switch?.().name === "scvAddress"
              ) {
                tokenA = hexToSorobanAddress(
                  Buffer.from(
                    JSON.parse(JSON.stringify(itemValue.value().value())).data
                  ).toString("hex")
                );
                logger.debug(
                  `[AQUA] 🔍 Found TokenA: ${JSON.stringify(tokenA)}`
                );
              } else if (
                symbolName === "TokenB" &&
                itemValue?.switch?.().name === "scvAddress"
              ) {
                tokenB = hexToSorobanAddress(
                  Buffer.from(
                    JSON.parse(JSON.stringify(itemValue.value().value())).data
                  ).toString("hex")
                );
                logger.debug(
                  `[AQUA] 🔍 Found TokenB: ${JSON.stringify(tokenB)}`
                );
              } else if (
                symbolName === "ReserveA" &&
                itemValue?.switch?.().name === "scvU128"
              ) {
                reserveA = BigInt(itemValue.u128().lo().toString());
                logger.debug(
                  `[AQUA] 🔍 Found ReserveA: ${reserveA.toString()}`
                );
              } else if (
                symbolName === "ReserveB" &&
                itemValue?.switch?.().name === "scvU128"
              ) {
                reserveB = BigInt(itemValue.u128().lo().toString());
                logger.debug(
                  `[AQUA] 🔍 Found ReserveB: ${reserveB.toString()}`
                );
              } else if (
                symbolName === "Fee" &&
                itemValue?.switch?.().name === "scvU32"
              ) {
                fee = BigInt(itemValue.u32().toString());
                logger.debug(`[AQUA] 🔍 Found Fee: ${fee.toString()}`);
              } else if (symbolName === "Reserves") {
                reserveA = BigInt(itemValue.vec()[0].u128().lo().toString());
                reserveB = BigInt(itemValue.vec()[1].u128().lo().toString());
                logger.debug(
                  `[AQUA] 🔍 Found Reserves: ${reserveA.toString()}, ${reserveB.toString()}`
                );
                if (itemValue.vec().length > 2) {
                  reserveC = BigInt(itemValue.vec()[2].u128().lo().toString());
                  logger.debug(`[AQUA] 🔍 Found ReserveC: ${reserveC.toString()}`);
                }
              } else if (
                symbolName === "FeeFraction" &&
                itemValue?.switch?.().name === "scvU32"
              ) {
                fee = BigInt(itemValue.u32().toString());
                logger.debug(`[AQUA] 🔍 Found FeeFraction: ${fee.toString()}`);
              } else if (symbolName === "Tokens") {
                tokenA = itemValue.vec()[0];

                tokenA = hexToSorobanAddress(
                  Buffer.from(
                    JSON.parse(
                      JSON.stringify(itemValue.vec()[0].value().value())
                    ).data
                  ).toString("hex")
                );
                tokenB = hexToSorobanAddress(
                  Buffer.from(
                    JSON.parse(
                      JSON.stringify(itemValue.vec()[1].value().value())
                    ).data
                  ).toString("hex")
                );
                
                if (itemValue.vec().length > 2) {
                  tokenC = hexToSorobanAddress(
                    Buffer.from(
                      JSON.parse(
                        JSON.stringify(itemValue.vec()[2].value().value())
                      ).data
                    ).toString("hex")
                  );
                  logger.debug(`[AQUA] 🔍 Found TokenC: ${JSON.stringify(tokenC)}`);
                }

                logger.debug(
                  `[AQUA] 🔍 Found Tokens: ${JSON.stringify(
                    tokenA
                  )}, ${JSON.stringify(tokenB)}`
                );
              } else if (symbolName === "FutureA" && itemValue?.switch?.().name === "scvU128") {
                futureA = BigInt(itemValue.u128().lo().toString());
                logger.debug(`[AQUA] 🔍 Found FutureA: ${futureA.toString()}`);
              } else if (symbolName === "FutureATime" && itemValue?.switch?.().name === "scvU64") {
                futureATime = BigInt(itemValue.u64().toString());
                logger.debug(`[AQUA] 🔍 Found FutureATime: ${futureATime.toString()}`);
              } else if (symbolName === "InitialA" && itemValue?.switch?.().name === "scvU128") {
                initialA = BigInt(itemValue.u128().lo().toString());
                logger.debug(`[AQUA] 🔍 Found InitialA: ${initialA.toString()}`);
              } else if (symbolName === "InitialATime" && itemValue?.switch?.().name === "scvU64") {
                initialATime = BigInt(itemValue.u64().toString());
                logger.debug(`[AQUA] 🔍 Found InitialATime: ${initialATime.toString()}`);
              } else if (symbolName === "PrecisionMul" && itemValue?.switch?.().name === "scvVec") {
                const vecLength = itemValue.vec().length;
                if (vecLength > 0) precisionMulA = BigInt(itemValue.vec()[0].u128().lo().toString());
                if (vecLength > 1) precisionMulB = BigInt(itemValue.vec()[1].u128().lo().toString());
                if (vecLength > 2) precisionMulC = BigInt(itemValue.vec()[2].u128().lo().toString());
                
                logger.debug(`[AQUA] 🔍 Found PrecisionMul: A=${precisionMulA}, B=${precisionMulB}, C=${precisionMulC}`);
              }
            }
          }
        }
      }
    }
  }

  // If we don't find the reserves in the contract instance, we try to find them in the previous format
  if (!reserveA || !reserveB) {
    reserves = filteredOperations.reduce((acc, operation) => {
      const rawKey =
        operation?.["_value"]?._attributes?.data?._value?._attributes?.key;
      const key = rawKey?._value === 1 ? "reserveA" : "reserveB";
      const rawReserve =
        operation?.["_value"]?._attributes?.data?._value?._attributes?.val;
      const reserve = rawReserve?._value?._attributes?.lo?._value;

      if (key && reserve) {
        acc[key] = reserve;
      }

      return acc;
    }, {});

    // Use the values found in the previous format if they were not found in the contract instance
    if (!reserveA && reserves.reserveA) {
      reserveA = BigInt(reserves.reserveA);
    }
    if (!reserveB && reserves.reserveB) {
      reserveB = BigInt(reserves.reserveB);
    }
  }

  logger.debug(
    `[AQUA] 🟢 Reserves: ReserveA=${
      reserveA?.toString() || "not found"
    }, ReserveB=${reserveB?.toString() || "not found"}, Fee=${
      fee?.toString() || "not found"
    }`
  );

  if (tokenC || reserveC || futureA || futureATime || initialA || initialATime || 
      precisionMulA || precisionMulB || precisionMulC) {
    logger.debug(
      `[AQUA] 🟢 StablePool params found - TokenC: ${tokenC ? "yes" : "no"}, ReserveC: ${
        reserveC?.toString() || "not found"
      }`
    );
  }

  return {
    tokenA,
    tokenB,
    tokenC,
    reserveA,
    reserveB,
    reserveC,
    fee,
    futureA,
    futureATime,
    initialA,
    initialATime,
    precisionMulA,
    precisionMulB,
    precisionMulC,
  };
}

// Function to get ledger key for contract instance
export function getLedgerKeyContractCode(contractId: string): string {
  try {
    // Create contract instance and get its footprint
    const contract = new Contract(contractId);

    // Get contract footprint (footprint)
    const footprint = contract.getFootprint();

    // Convert to XDR in base64 format
    const xdrBase64 = footprint.toXDR("base64");

    logger.debug(
      `[AQUA] 🔍 Generated ledger key for ${contractId}: ${xdrBase64}`
    );

    return xdrBase64;
  } catch (error) {
    logger.error(`[AQUA] ❌ Error generating ledger key: ${error}`);
    throw error;
  }
}
