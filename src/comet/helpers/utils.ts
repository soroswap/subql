import { Contract, StrKey } from "@stellar/stellar-sdk";
import { config } from 'dotenv';
import { xdr } from '@stellar/stellar-sdk';
import { encodeContract } from "../../soroswap/helpers/utils";


config();

export function hexToSorobanAddress(hexString: string): string {
    const buffer = Buffer.from(hexString, 'hex');
    return StrKey.encodeContract(buffer);
}
export function getTransactionData(event: any, contractId: string): any {
      
  const resultMetaXdrString = event.transaction.result_meta_xdr;

  const txMeta = xdr.TransactionMeta.fromXDR(resultMetaXdrString, "base64");

  logger.info(`--------------------------------------------------------`);

  const txOperations = txMeta.v3().operations()[0].changes();

  logger.info(`[COMET] 🟢 Operations Length: ${txOperations.length}`);

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
  
  // Variables para almacenar los datos que buscamos
  let reserveA: bigint | undefined;
  let reserveB: bigint | undefined;
  let tokenA: string | undefined;
  let tokenB: string | undefined;
  
  // Buscar en las operaciones filtradas para encontrar AllRecordData
  for (const operation of txOperations) {
    const switchName = operation?.["_switch"]?.name;
    logger.info(`[COMET] 🔍 Switch Name: ${switchName}`);
    if (switchName === "ledgerEntryUpdated") {
      const data = operation?.value()?.data()?.["_value"]?._attributes;
      const key = data?.key?._value?._attributes?.vec;
      logger.info(`[COMET] 🔍 Key: ${key}`);
      logger.info(`[COMET] 🔍 data: ${JSON.stringify(data)}`);
      // Buscar AllRecordData
      if (key && key.length > 0 && key[0]?._attributes?.sym?.toString() === "AllRecordData") {
        const val = data?.val?._value?._attributes?.map;
        logger.info(`[COMET] 🔍 Val: ${val}`);
        if (val && Array.isArray(val)) {
          // Extraer las direcciones de los tokens y sus pesos
          const tokens = val.map(item => {
            const address = item?.key()?._attributes?.address?.toString();
            const weight = item?.val()?._attributes?.map?.find(
              m => m?.key()?._attributes?.sym?.toString() === "weight"
            )?.val()?._attributes?.i128?.lo?.toString();
            
            const balance = item?.val()?._attributes?.map?.find(
              m => m?.key()?._attributes?.sym?.toString() === "balance"
            )?.val()?._attributes?.i128?.lo?.toString();
            logger.info(`[COMET] 🔍 Address: ${address}`);
            logger.info(`[COMET] 🔍 Weight: ${weight}`);
            logger.info(`[COMET] 🔍 Balance: ${balance}`);


            return { 
              address, 
              weight: weight ? BigInt(weight) : undefined,
              balance: balance ? BigInt(balance) : undefined
            };
          });
          
          // Ordenar por peso (mayor peso primero)
          tokens.sort((a, b) => {
            if (!a.weight || !b.weight) return 0;
            return Number(b.weight - a.weight);
          });
          
          // El token con mayor peso es tokenA, el siguiente es tokenB
          if (tokens.length >= 2) {
            tokenA = tokens[0].address;
            tokenB = tokens[1].address;
            reserveA = tokens[0].balance;
            reserveB = tokens[1].balance;
            
            logger.info(`[COMET] 🔍 Found TokenA from AllRecordData: ${tokenA} (weight: ${tokens[0].weight})`);
            logger.info(`[COMET] 🔍 Found TokenB from AllRecordData: ${tokenB} (weight: ${tokens[1].weight})`);
            logger.info(`[COMET] 🔍 Found ReserveA from AllRecordData: ${reserveA}`);
            logger.info(`[COMET] 🔍 Found ReserveB from AllRecordData: ${reserveB}`);
          }
        }
      }
      
      // Buscar Fee
      // if (key && key.length > 0 && key[0]?._attributes?.sym?.toString() === "Fee") {
      //   const val = data?.val?._value;
      //   if (val?._switch?.name === "scvU32") {
      //     fee = BigInt(val.u32().toString());
      //     logger.info(`[COMET] 🔍 Found Fee: ${fee.toString()}`);
      //   }
      // }
    }
  }

  logger.info(
    `[COMET] 🟢 Tokens: TokenA=${tokenA || "not found"}, TokenB=${tokenB || "not found"}`
  );
  logger.info(
    `[COMET] 🟢 Reserves: ReserveA=${reserveA?.toString() || "not found"}, ReserveB=${reserveB?.toString() || "not found"}`
  );

  return {
    tokenA,
    tokenB,
    reserveA,
    reserveB
  };
}



// export function getTransactionData(event: any, contractId: string): any {
      
//         const resultMetaXdrString = event.transaction.result_meta_xdr;
//         logger.info(`[COMET] 🔍 Result Meta XDR: ${resultMetaXdrString}`);
      
//         const txMeta = xdr.TransactionMeta.fromXDR(resultMetaXdrString, "base64");
//         logger.info(`[COMET] 🔍 Transaction Meta: ${txMeta}`);
//         logger.info(`--------------------------------------------------------`);
      
//         const txOperations = txMeta.v3().operations()[0].changes();
      
//         logger.info(`[COMET] 🟢 Operations Length: ${txOperations.length}`);
      
//         // Buscar las operaciones que actualizan el contrato específico
//         const filteredOperations = txOperations.filter((operation) => {
//           const switchName = operation?.["_switch"]?.name;
//           const contractBuffer = operation?.value()?.data()?.["_value"]?._attributes
//             ?.contract?._value;
//           if (switchName === "ledgerEntryUpdated" && contractBuffer) {
//             const contractData = JSON.parse(JSON.stringify(contractBuffer)).data;
//             const contract = encodeContract(
//               Buffer.from(contractData).toString("hex")            
//             );
//             return contract === contractId;

//           }
//           return false;
//         });      
//         // Found the values of ReserveA, ReserveB and FeeFraction in the contract
//         let reserveA: bigint | undefined;
//         let reserveB: bigint | undefined;
//         let fee: bigint | undefined;
//         let poolType: string | undefined;
//         let reserves: any | undefined;
//         // Search in the filtered operations        
//         for (const operation of filteredOperations) {
//           // Verify if it is an update of the contract instance
//           const val = operation?.["_value"]?._attributes?.data?._value?._attributes?.val;
//           if (val?._switch?.name === "scvContractInstance") { // find data storage from contract instance
//             const storage = val?.instance()?._attributes?.storage;
            
//             if (storage && Array.isArray(storage)) {
//               // Iterate over the storage to find the keys that we are interested in
//               for (const item of storage) {
//                 const key = item?.key();
//                 const keyVec = key?.vec?.();
                
//                 if (keyVec && keyVec.length > 0) {
//                   const firstElement = keyVec[0];
                  
//                   if (firstElement?.switch?.().name === "scvSymbol") {
//                     const symbolName = firstElement.sym().toString();
//                     const itemValue = item.val();
                    
//                     // Extract the values according to the symbol name
//                     if (symbolName === "ReserveA" && itemValue?.switch?.().name === "scvU128") {
//                       reserveA = BigInt(itemValue.u128().lo().toString());
//                       logger.info(`[COMET] 🔍 Found ReserveA: ${reserveA.toString()}`);
//                     }
                     
//                     else if (symbolName === "ReserveB" && itemValue?.switch?.().name === "scvU128") {
//                       reserveB = BigInt(itemValue.u128().lo().toString());
//                       logger.info(`[COMET] 🔍 Found ReserveB: ${reserveB.toString()}`);
//                     }
//                     else if (symbolName === "Fee" && itemValue?.switch?.().name === "scvU32") {
//                         fee = BigInt(itemValue.u32().toString());
//                         logger.info(`[COMET] 🔍 Found Fee: ${fee.toString()}`);
//                       }
//                     else if (symbolName === "Reserves") {
//                         reserveA = BigInt(itemValue.vec()[0].u128().lo().toString());
//                         reserveB = BigInt(itemValue.vec()[1].u128().lo().toString());
//                         logger.info(`[COMET] 🔍 Found Reserves: ${reserveA.toString()}, ${reserveB.toString()}`);
//                       }      
//                     else if (symbolName === "FeeFraction" && itemValue?.switch?.().name === "scvU32") {
//                       fee = BigInt(itemValue.u32().toString());
//                       logger.info(`[COMET] 🔍 Found FeeFraction: ${fee.toString()}`);
//                     }
//                   }
//                 }
//               }
//             }
//           }
//         }
        
//         // If we don't find the reserves in the contract instance, we try to find them in the previous format
//         if (!reserveA || !reserveB) {
//           reserves = filteredOperations.reduce((acc, operation) => {
//             const rawKey =
//               operation?.["_value"]?._attributes?.data?._value?._attributes?.key;
//             const key = rawKey?._value === 1 ? "reserveA" : "reserveB";
//             const rawReserve =
//               operation?.["_value"]?._attributes?.data?._value?._attributes?.val;
//             const reserve = rawReserve?._value?._attributes?.lo?._value;
        
//             if (key && reserve) {
//               acc[key] = reserve;
//             }
        
//             return acc;
//           }, {});
          
//           // Use the values found in the previous format if they were not found in the contract instance
//           if (!reserveA && reserves.reserveA) {
//             reserveA = BigInt(reserves.reserveA);
//           }
//           if (!reserveB && reserves.reserveB) {
//             reserveB = BigInt(reserves.reserveB);
//           }
//         }
      
//         logger.info(
//           `[AQUA] 🟢 Reserves: ReserveA=${reserveA?.toString() || "not found"}, ReserveB=${reserveB?.toString() || "not found"}, Fee=${fee?.toString() || "not found"}`
//         );
      
//         return {
//           reserveA,
//           reserveB,
//           fee
//         };
// }

// Function to get ledger key for contract instance
export function getLedgerKeyContractCode(contractId: string): string {
    try {
        // Create contract instance and get its footprint
        const contract = new Contract(contractId);
        
        // Get contract footprint (footprint)
        const footprint = contract.getFootprint();
        
        // Convert to XDR in base64 format
        const xdrBase64 = footprint.toXDR("base64");
        
        logger.debug(`[COMET] 🔍 Generated ledger key for ${contractId}: ${xdrBase64}`);
        
        return xdrBase64;
    } catch (error) {
        logger.error(`[COMET] ❌ Error generating ledger key: ${error}`);
        throw error;
    }
}