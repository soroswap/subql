import { Contract, StrKey } from "@stellar/stellar-sdk";
import { config } from 'dotenv';
import fetch from 'node-fetch';
import { xdr } from '@stellar/stellar-sdk';
import { encodeContract } from "../../soroswap/helpers/utils";
import { exit } from "process";

config();

// Default Soroban endpoint
// const SOROBAN_ENDPOINT = process.env.SOROBAN_ENDPOINT || 'https://soroban-mainnet.stellar.org';
const SOROBAN_ENDPOINT = process.env.SOROBAN_ENDPOINT_FETCH || 'https://soroban-mainnet.stellar.org';
export function hexToSorobanAddress(hexString: string): string {
    const buffer = Buffer.from(hexString, 'hex');
    return StrKey.encodeContract(buffer);
}
export function getTransactionData(event: any, contractId: string): any {
      
        const resultMetaXdrString = event.transaction.result_meta_xdr;
        logger.info(`🔍 🔴🔴🔴🔴 contractId: ${contractId}`);
      
        const txMeta = xdr.TransactionMeta.fromXDR(resultMetaXdrString, "base64");
      
        logger.info(`--------------------------------------------------------`);
      
        const txOperations = txMeta.v3().operations()[0].changes();
      
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
        let poolType: string | undefined;
        let reserves: any | undefined;
        // Buscar en las operaciones filtradas        
        for (const operation of filteredOperations) {
          // Verificar si es una actualización del contrato instance
          const val = operation?.["_value"]?._attributes?.data?._value?._attributes?.val;
          if (val?._switch?.name === "scvContractInstance") { // find data storage from contract instance
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
                    else if (symbolName === "Fee" && itemValue?.switch?.().name === "scvU32") {
                        fee = BigInt(itemValue.u32().toString());
                        logger.info(`🔍 Found Fee: ${fee.toString()}`);
                      }
                    else if (symbolName === "Reserves") {
                        reserveA = BigInt(itemValue.vec()[0].u128().lo().toString());
                        reserveB = BigInt(itemValue.vec()[1].u128().lo().toString());
                        logger.info(`🔍 Found Reserves: ${reserveA.toString()}, ${reserveB.toString()}`);
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

// Function to get ledger key for contract instance
export function getLedgerKeyContractCode(contractId: string): string {
    try {
        // Create contract instance and get its footprint
        const contract = new Contract(contractId);
        
        // Get contract footprint (footprint)
        const footprint = contract.getFootprint();
        
        // Convert to XDR in base64 format
        const xdrBase64 = footprint.toXDR("base64");
        
        logger.info(`🔍 Generated ledger key for ${contractId}: ${xdrBase64}`);
        
        return xdrBase64;
    } catch (error) {
        logger.error(`❌ Error generating ledger key: ${error}`);
        throw error;
    }
}

// Function to get contract data using getLedgerEntries
export async function getContractDataFetch(contractId: string): Promise<{reserveA?: bigint, reserveB?: bigint, fee?: bigint}> {
    try {
        logger.info(`🔍 Getting contract data for: ${contractId}`);
        const ledgerKey = getLedgerKeyContractCode(contractId);
        const requestBody = {
            "jsonrpc": "2.0",
            "id": 8675309,
            "method": "getLedgerEntries",
            "params": {
                "keys": [
                    ledgerKey
                ]
            }
        };

        const res = await fetch(SOROBAN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
        
        
        let json = await res.json();
        logger.info(`🔍 Response received from server`);

        // Check if there are entries in the response
        if (json.result && json.result.entries) {
            let xdrData: any;
            try {
                // Get the XDR from the first entry
                xdrData = json.result.entries[0].xdr;
                logger.info(`🔍 XDR data retrieved`);
            } catch (error) {
                logger.error(`❌ Error decoding XDR: ${error}`);
                throw error;
            }

            try {
                // Try to decode the XDR
                const decodedData = xdr.LedgerEntryData.fromXDR(xdrData, 'base64');
                
                // If it's contract data, extract more information
                if (decodedData.switch().name === 'contractData') {
                    const contractData = decodedData.contractData();
                    
                    // Extract ReserveA and ReserveB
                    if (contractData.val().switch().name === 'scvContractInstance') {
                        const instance = contractData.val().instance();
                        if (instance && instance.storage()) {
                            const storage = instance.storage();
                            
                            // Create an object to store the values
                            const contractValues: { [key: string]: any } = {};
                            
                            if(storage) {
                                // Look for ReserveA and ReserveB in the storage
                                for (let i = 0; i < storage.length; i++) {
                                    const entry = storage[i];
                                    const key = entry.key();
                                    
                                    // Check if the key is a vector containing a symbol
                                    const keyVec = key.switch().name === 'scvVec' ? key.vec() : null;
                                    if (keyVec && keyVec.length > 0) {
                                        const firstElement = keyVec[0];
                                        if (firstElement && firstElement.switch().name === 'scvSymbol') {
                                            // Convert buffer to string for comparison
                                            const symbolBuffer = firstElement.sym();
                                            const symbolText = Buffer.from(symbolBuffer).toString();
                                            
                                            // Get the value
                                            const val = entry.val();
                                            
                                            // Store in the values object
                                            contractValues[symbolText] = val;
                                            logger.info(`→ ${symbolText}: ${val}`);
                                        }
                                    }
                                }
                                
                                // search reserves - they can have different names depending on the contract
                                let reserveA: bigint | undefined;
                                let reserveB: bigint | undefined;
                                let fee: bigint | undefined;
                                   
                                // search reserveA
                                if (contractValues["ReserveA"] !== undefined) {
                                        const reserveAVal = contractValues["ReserveA"];
                                        if (reserveAVal.switch().name === 'scvU128') {
                                            reserveA = BigInt(reserveAVal.u128().lo().toString());
                                            logger.info(`→ ReserveA : ${reserveA.toString()}`);                                        
                                        }
                                    
                                }
                                
                                // search reserveB
                                if (contractValues["ReserveB"] !== undefined) {
                                        const reserveBVal = contractValues["ReserveB"];
                                        if (reserveBVal.switch().name === 'scvU128') {
                                            reserveB = BigInt(reserveBVal.u128().lo().toString());
                                            logger.info(`→ ReserveB : ${reserveB.toString()}`);
                                        }
                                
                                    
                                }
                                // search reserveA and reserveB
                                if (contractValues["Reserves"] !== undefined) {
                                    reserveA = contractValues["Reserves"][0];
                                    reserveB = contractValues["Reserves"][1];
                                    logger.info(`→ ReserveA : ${reserveA}`);
                                    logger.info(`→ ReserveB : ${reserveB}`);
                                }
                                
                                // search fee
                                
                                if (contractValues["Fee"] !== undefined) {
                                        const fee = contractValues["Fee"];
                                        logger.info(`→ Fee : ${fee}`);
                                    }
                                
                                // search feeFraction
                                if (contractValues["FeeFraction"] !== undefined) {
                                    const fee = contractValues["FeeFraction"];
                                    logger.info(`→ FeeFraction : ${fee}`);
                                }
                                
                                return {
                                    reserveA,
                                    reserveB,
                                    fee
                                };
                            }
                        }
                    }
                }
            } catch (error) {
                logger.error("❌ Error decoding XDR:", error);
            }
        }
        
        return {};
    } catch (error) {
        logger.error("❌ Error getting contract data:", error);
        return {};
    }
}

