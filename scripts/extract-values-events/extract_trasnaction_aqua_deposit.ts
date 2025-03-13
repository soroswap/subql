import { Contract, StrKey } from "@stellar/stellar-sdk";
import { config } from 'dotenv';
import fetch from 'node-fetch';
import { xdr } from '@stellar/stellar-sdk';
import { encodeContract } from "../../src/soroswap/helpers/utils";

async function extract_trasnaction_aqua_deposit(event: any): Promise<{
    reserveA: bigint | undefined;
    reserveB: bigint | undefined;
    fee: bigint | undefined;
    poolType: string | undefined;
  }> {
const txOperations = txMeta.v3().operations()[0].changes();{
      
logger.info(`🟢 Operations Length: ${txOperations.length}`);

// Buscar las operaciones que actualizan el contrato específico
const filteredOperations = txOperations.filter((operation) => {
  const switchName = operation?.["_switch"]?.name;
  const contractBuffer = operation?.value()?.data()?.["_value"]?._attributes
    ?.contract?._value;

  if (switchName === "ledgerEntryUpdated" && contractBuffer) {
    const contractData = JSON.parse(JSON.stringify(contractBuffer)).data;
    const contract = encodeContract(
      Buffer.from(contractData).toString("hex")
    );
    return contract === contractId;
  }
  return false;
});

// Buscar los valores de ReserveA, ReserveB y FeeFraction en el contrato
let reserveA: bigint | undefined;
let reserveB: bigint | undefined;
let fee: bigint | undefined;

// Buscar en las operaciones filtradas
for (const operation of filteredOperations) {
  // Verificar si es una actualización del contrato instance
  const val = operation?.["_value"]?._attributes?.data?._value?._attributes?.val;
  
  if (val?._switch?.name === "contractInstance") {
    const storage = val?.instance()?._attributes?.storage;
    
    if (storage && Array.isArray(storage)) {
      // Recorrer el almacenamiento buscando las claves que nos interesan
      for (const item of storage) {
        const key = item?.key();
        const keyVec = key?.vec?.();
        
        if (keyVec && keyVec.length > 0) {
          const firstElement = keyVec[0];
          
          if (firstElement?.switch?.().name === "scvSymbol") {
            const symbolName = firstElement.sym().toString();
            const itemValue = item.val();
            
            // Extraer los valores según el nombre del símbolo
            if (symbolName === "ReserveA" && itemValue?.switch?.().name === "scvU128") {
              reserveA = BigInt(itemValue.u128().lo().toString());
              logger.info(`🔍 Found ReserveA: ${reserveA.toString()}`);
            } 
            else if (symbolName === "ReserveB" && itemValue?.switch?.().name === "scvU128") {
              reserveB = BigInt(itemValue.u128().lo().toString());
              logger.info(`🔍 Found ReserveB: ${reserveB.toString()}`);
            }
            else if (symbolName === "FeeFraction" && itemValue?.switch?.().name === "scvU32") {
              fee = BigInt(itemValue.u32().toString());
              logger.info(`🔍 Found FeeFraction: ${fee.toString()}`);
            }
          }
        }
      }
    }
  }
}

// Si no encontramos las reservas en el contrato instance, intentamos buscarlas en el formato anterior
if (!reserveA || !reserveB) {
  const reserves = filteredOperations.reduce((acc, operation) => {
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
  
  // Usar los valores encontrados en el formato anterior si no se encontraron en el contrato instance
  if (!reserveA && reserves.reserveA) {
    reserveA = BigInt(reserves.reserveA);
  }
  if (!reserveB && reserves.reserveB) {
    reserveB = BigInt(reserves.reserveB);
  }
}

logger.info(
  `🟢 Reserves: ReserveA=${reserveA?.toString() || "not found"}, ReserveB=${reserveB?.toString() || "not found"}, Fee=${fee?.toString() || "not found"}`
);

return {
  reserveA,
  reserveB,
  fee
};
}