import { Contract, StrKey } from "@stellar/stellar-sdk";
import { config } from 'dotenv';
import fetch from 'node-fetch';
import { xdr } from '@stellar/stellar-sdk';

config();

// Default Soroban endpoint
// const SOROBAN_ENDPOINT = process.env.SOROBAN_ENDPOINT || 'https://soroban-mainnet.stellar.org';
const SOROBAN_ENDPOINT = process.env.SOROBAN_ENDPOINT_FETCH || 'https://soroban-mainnet.stellar.org';
export function hexToSorobanAddress(hexString: string): string {
    const buffer = Buffer.from(hexString, 'hex');
    return StrKey.encodeContract(buffer);
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

