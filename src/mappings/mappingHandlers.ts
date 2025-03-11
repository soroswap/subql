import { SorobanEvent } from "@subql/types-stellar";
import { initializeDB } from "../intialize";
import { soroswapNewPairHandler, soroswapSyncHandler } from "../soroswap";
import { extractValuesNewPair } from "../soroswap/helpers/newPairEvent";

import { SoroswapPair } from "../types";
import { config } from 'dotenv';
import { StrKey, xdr, rpc, Contract, scValToNative, Address } from '@stellar/stellar-sdk';
import { pairTokenReservesList } from "./pairTokenRsv";
import { aquaPoolsList } from "./aquaPools";
import { Pair, PairsAqua } from "../types";
import fetch from 'node-fetch';

// SOROSWAP SYNC EVENTS
export async function handleSoroswapEventSync(
  event: SorobanEvent
): Promise<void> {
  logger.info(`🔁 Sync event received`);
  await initializeDB();
  return await soroswapSyncHandler(event);
}

// SOROSWAP PAIR EVENTS
export async function handleSoroswapEventNewPair(
  event: SorobanEvent
): Promise<void> {
  logger.info(`🔁 NewPair event received`);
  return await soroswapNewPairHandler(event);
}



config();

let initialized = false;
let aquaInitialized = false;

// Default Soroban endpoint
const SOROBAN_ENDPOINT = process.env.SOROBAN_ENDPOINT || 'https://soroban-testnet.stellar.org';

const server = new rpc.Server(SOROBAN_ENDPOINT, { allowHttp: true });

interface ReservesResult {
    reserveA: bigint;
    reserveB: bigint;
}

// AQUA DEPOSIT LIQUIDITY EVENTS
export async function handleEventDepositAqua(event: SorobanEvent): Promise<void> {
    logger.info(`🔄 🔴🔴🔴🔴 AQUA DEPOSIT LIQUIDITY EVENTS`);
    if (!aquaInitialized) {
        await initializeAqua();
        aquaInitialized = true;
    }
    // // 1. Test for error example with Incomplete Data
    // try {
    //     const test = event.value;
    //     logger.info(`🔍 🔴🔴🔴🔴 test: ${JSON.stringify(test)}`);
    //     logger.info(`🔍 🔴🔴🔴🔴 testTransaction: ${JSON.stringify(event.transaction)}`);
    //     const testResultXdr = event.transaction.result_meta_xdr;
    //     logger.info(`🔍 🔴🔴🔴🔴 testResultMetaXdr: ${testResultXdr}`);
    //     logger.info(`🔍 🔴🔴🔴🔴 testResultXdrString: ${testResultXdr.toString()}`);
    // } catch (error) {
    //     logger.error("❌🔴🔴 Error processing Aqua deposit event transaction: ${error}");
    //     throw error;
    // }


    // // 2. Test for error example with getContractData using axios
    // try {
    //     const contractId = "CAQVZKCFWX4HT3C3RUXGR7OETDKRMN433M2QWUXC5X64WE2FKDUFA7GQ";
    //     const ledgerKey = getLedgerKeyContractCode(contractId);
    //     const test = await server.getContractData(new Address(contractId),xdr.ScVal.scvLedgerKeyContractInstance());
    //     logger.info("🔍 test:❌❌❌❌❌");
    //     logger.info(test);
    // } catch (error) {
    //     throw(error);
    // }
    // 3. Test for error example with getContractDataFetch incomplete data
    try {
        const contractId = "CAQVZKCFWX4HT3C3RUXGR7OETDKRMN433M2QWUXC5X64WE2FKDUFA7GQ";
        const contractData = await getContractDataFetch(contractId);
        logger.info(`🔍 🔴🔴🔴🔴 contractData: ${JSON.stringify(contractData)}`);
    } catch (error) {
        logger.error(`❌ Error processing Aqua deposit event: ${error}`);
        throw error;
    }
    try {
        logger.info(`🔄 Processing AQUA DEPOSIT LIQUIDITY EVENT`);
        
        // Extract data from the event
        const depositData = await extractDepositAquaValues(JSON.parse(JSON.stringify(event)));
        
        // Check if we have the contract address
        if (!depositData.address) {
            logger.error(`❌ No contract address found in deposit event`);
            return;
        }
        
        // Look for the pool in the database
        const existingPool = await PairsAqua.get(depositData.address);
        if (!existingPool) {
            logger.info(`⚠️ Pool ${depositData.address} not found in database, creating new record`);
            
            // Create a new record if it doesn't exist
            const newPool = PairsAqua.create({
                id: depositData.address,
                ledger: event.ledger.sequence,
                date: new Date(event.ledgerClosedAt),
                address: depositData.address,
                tokenA: depositData.tokenA,
                tokenB: depositData.tokenB,
                poolType: 'unknown', // We could get this from another source
                reserveA: depositData.reserveA || BigInt(0),
                reserveB: depositData.reserveB || BigInt(0)
            });
            
            await newPool.save();
            logger.info(`✅ Created new pool record for ${depositData.address}`);
            return;
        }
        
        // Check if the event is more recent than existing data
        const currentDate = new Date(event.ledgerClosedAt);
        if (new Date(existingPool.date) > currentDate) {
            logger.info(`⏭️ Existing pool data is more recent, NOT updating`);
            return;
        }
        
        // Update the existing record with new data
        if (depositData.reserveA !== undefined) {
            existingPool.reserveA = depositData.reserveA;
        }
        
        if (depositData.reserveB !== undefined) {
            existingPool.reserveB = depositData.reserveB;
        }
        
        existingPool.date = currentDate;
        existingPool.ledger = event.ledger.sequence;
        
        await existingPool.save();
        logger.info(`✨ Updated reserves for pool ${depositData.address}`);
        
    } catch (error) {
        logger.error(`❌ Error processing Aqua deposit event: ${error}`);
        throw error;
    }
}

// SYNC EVENTS SOROSWAP PROTOCOL
export async function handleEventSync(event: SorobanEvent): Promise<void> {
    if (!initialized) {
        await initialize();
        initialized = true;
    }
    // get contract address
    const address = event.contractId?.contractId().toString();
    if (!address) {
        logger.info(`🔴🔴🔴🔴 Error: Invalid contract address`);
        return;
    }
    // get pair from database and check if it exists
    const existingPair = await Pair.get(address);
    if (!existingPair) {
        logger.info(`🔴🔴🔴🔴 Error: Contract ${address} not work with soroswap, not processing`);
        return;
    }

    try { 
        const { reserveA, reserveB } = extractReserves(JSON.parse(JSON.stringify(event)));
        
        const currentDate = new Date(event.ledgerClosedAt);
        if (new Date(existingPair.date) > currentDate) {
            logger.info(`⏭️ Existing data is more recent, NOT updating`);
            return;
        }

        // Update only reserves and date
        existingPair.reserveA = reserveA;
        existingPair.reserveB = reserveB;
        existingPair.date = currentDate;
        existingPair.ledger = event.ledger.sequence;

        await existingPair.save();
        logger.info(`✨ Updated reserves for pair ${address}`);
        
    } catch (error) {
        logger.error(`❌🔴🔴 Error processing sync event: ${error}`);
        throw error;
    }
}
// NEW PAIR EVENTS SOROSWAP PROTOCOL    
export async function handleEventNewPair(event: SorobanEvent): Promise<void> {
    if (!initialized) {
        await initialize();
        initialized = true;
    }

    try {
        const { tokenA, tokenB, address } = extractValuesNewPair(JSON.parse(JSON.stringify(event)));

        // Create new pair or update if it exists
        const existingPair = await Pair.get(address);
        const currentDate = new Date(event.ledgerClosedAt);

        if (existingPair && new Date(existingPair.date) > currentDate) {
            logger.info(`⏭️ Existing pair data is more recent, NOT updating`);
            return;
        }

        const pair = Pair.create({
            id: address,
            ledger: event.ledger.sequence,
            date: currentDate,
            tokenA: tokenA,
            tokenB: tokenB,
            reserveA: existingPair ? existingPair.reserveA : BigInt(0),
            reserveB: existingPair ? existingPair.reserveB : BigInt(0)
        });

        await pair.save();
        logger.info(`✅ Pair ${address} created/updated`);

    } catch (error) {
        logger.error(`❌🔴🔴 Error processing NewPair event: ${error}`);
        throw error;
    }
}
// AQUA SWAP EVENTS AQUA PROTOCOL
export async function handleEventAddPoolAqua(event: SorobanEvent): Promise<void> {
    if (!aquaInitialized) {
        await initializeAqua();
        aquaInitialized = true;
    }

    try {
        const eventData = extractAddPoolAquaValues(JSON.parse(JSON.stringify(event)));
        const currentDate = new Date(event.ledgerClosedAt);

        // Check if there is a previous record for this user
        const existingPool = await PairsAqua.get(eventData.address);
        
        // If there is a more recent record, do not update
        if (existingPool && new Date(existingPool.date) > currentDate) {
            logger.info(`⏭️ Existing pool data for contract ${eventData.address} is more recent, NOT updating`);
            return;
        }

        // Create or update record
        const pairAqua = PairsAqua.create({
            id: eventData.address,
            ledger: event.ledger.sequence,
            date: currentDate,
            address: eventData.address,
            tokenA: eventData.tokenA,
            tokenB: eventData.tokenB,
            poolType: eventData.poolType,
            reserveA: BigInt(0), // Initialized in 0
            reserveB: BigInt(0)  // Initialized in 0
        });

        await pairAqua.save();
        logger.info(`✅ Pool event created/updated for address: ${eventData.address}`);

    } catch (error) {
        logger.error(`❌ Error processing Aqua Pool event: ${error}`);
        throw error;
    }
}

//######################### HELPERS #########################


// Helper function to extract values from deposit event
async function extractDepositAquaValues(event: any): Promise<{
    address: string;
    tokenA: string;
    tokenB: string;
    reserveA?: bigint;
    reserveB?: bigint;
    effects?: any[];
}> {
    let result = {
        address: '',
        tokenA: '',
        tokenB: '',
        reserveA: undefined as bigint | undefined,
        reserveB: undefined as bigint | undefined,
        effects: []
    };

    try {
        logger.info("\n🔄 Processing Aqua Deposit event values:");

        // User address (first value of the value)
        const contractBuffer = event?.contractId?._id?.data;
        if (contractBuffer) {
            result.address = hexToSorobanAddress(Buffer.from(contractBuffer).toString('hex'));
            logger.info(`→ Contract address: ${result.address}`);
        }
        // Token A
        const topicTokens1 = event?.topic?.[1]?._value;
        const tokenABuffer = topicTokens1?._value?.data;
        if (tokenABuffer) {
            result.tokenA = hexToSorobanAddress(Buffer.from(tokenABuffer).toString('hex'));
            logger.info(`→ Token A: ${result.tokenA}`);
        }
        // Token B
        const topicTokens2 = event?.topic?.[2]?._value;
        const tokenBBuffer = topicTokens2?._value?.data;
        if (tokenBBuffer) {
            result.tokenB = hexToSorobanAddress(Buffer.from(tokenBBuffer).toString('hex'));
            logger.info(`→ Token B: ${result.tokenB}`);
        }
        
        if (!result.address || !result.tokenA || !result.tokenB) {
            throw new Error('Incomplete data in Deposit event');
        }

        // Get contract data using getLedgerEntries
        if (result.address) {
            logger.info(`🔍 Fetching contract data for ${result.address}...`);
            let contractData = await getContractDataFetch("CA6PUJLBYKZKUEKLZJMKBZLEKP2OTHANDEOWSFF44FTSYLKQPIICCJBE");
            
            
            if (contractData.reserveA !== undefined) {
                result.reserveA = contractData.reserveA;
                logger.info(`→ ReserveA from contract: ${result.reserveA.toString()}`);
            }
            
            if (contractData.reserveB !== undefined) {
                result.reserveB = contractData.reserveB;
                logger.info(`→ ReserveB from contract: ${result.reserveB.toString()}`);
            }
            
            // If no data is found, use default values
            if (result.reserveA === undefined && result.reserveB === undefined) {
                logger.info(`⚠️ No reserve data found for contract ${result.address}, using default values`);
                result.reserveA = BigInt(0);
                result.reserveB = BigInt(0);
            }
        }

        return result;
    } catch (error) {
        logger.error(`❌ Error extracting Aqua Deposit values: ${error}`);
        return result;
    }
}


// Function to get contract data using getLedgerEntries
async function getContractDataFetch(contractId: string): Promise<{reserveA?: bigint, reserveB?: bigint}> {
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
        
        const json = await res.json();
        logger.info(`🔍 🔴🟣🟢🔵 Response: ${JSON.stringify(json)}`);
        logger.info(`🔍 🟢🟢🟢🟢 json.result.entries.length: ${json.result.entries.length}`);
        // Check if there are entries in the response
        if (json.result && json.result.entries) {
            let xdrData: any;
            try {
            // Get the XDR from the first entry
                const jsonResult = json.result; 
                logger.info(`🔍 🔴🔴🔴 jsonResult string: ${JSON.stringify(jsonResult)}`);
                const jsonEntries = jsonResult.entries;
                logger.info(`🔍 🔴🔴 jsonEntries: ${JSON.stringify(jsonEntries)}`);
                const jsonEntry = jsonEntries[0];
                logger.info(`🔍 🔴 jsonEntry: ${JSON.stringify(jsonEntry)}`);
                let xdrData = jsonEntry.xdr;
                logger.info(`🔍 ✅  XDR data: ${JSON.stringify(xdrData)}`);
            } catch (error) {
                logger.error(`❌ Error decoding XDR: ${error}`);
            }

            try {
                // Try to decode the XDR
                const decodedData = xdr.LedgerEntryData.fromXDR(xdrData, 'base64');
                logger.info(`🔍 🔴🔴🔴 Decoded data: ${JSON.stringify(decodedData)}`);
                // If it's contract data, extract more information
                if (decodedData.switch().name === 'contractData') {
                    const contractData = decodedData.contractData();
                    logger.info(`🔍 🔴🔴 Contract data: ${JSON.stringify(contractData)}`);
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
                                        }
                                    }
                                }
                                
                                // search reserves - they can have different names depending on the contract
                                let reserveA: bigint | undefined;
                                let reserveB: bigint | undefined;
                                
                                // possible names for reserves
                                const reserveANames = ["ReserveA", "reserve_a", "reserve0", "Reserve0"];
                                const reserveBNames = ["ReserveB", "reserve_b", "reserve1", "Reserve1"];
                                
                                // search reserveA
                                for (const name of reserveANames) {
                                    if (contractValues[name] !== undefined) {
                                        const reserveAVal = contractValues[name];
                                        if (reserveAVal.switch().name === 'scvU128') {
                                            reserveA = BigInt(reserveAVal.u128().lo().toString());
                                            console.log(`→ ReserveA (${name}): ${reserveA.toString()}`);
                                            break;
                                        }
                                    }
                                }
                                
                                // search reserveB
                                for (const name of reserveBNames) {
                                    if (contractValues[name] !== undefined) {
                                        const reserveBVal = contractValues[name];
                                        if (reserveBVal.switch().name === 'scvU128') {
                                            reserveB = BigInt(reserveBVal.u128().lo().toString());
                                            console.log(`→ ReserveB (${name}): ${reserveB.toString()}`);
                                            break;
                                        }
                                    }
                                }
                                
                                // if we don't find the reserves, show all available keys
                                if (reserveA === undefined || reserveB === undefined) {
                                    console.log("⚠️ Not all reserves found. Available keys:");
                                    Object.keys(contractValues).forEach(key => {
                                        console.log(`- ${key}`);
                                    });
                                }
                                
                                return {
                                    reserveA,
                                    reserveB
                                };
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("❌ Error decoding XDR:", error);
            }
        } else {
            console.log("No entries found in the response or incorrect format.");
        }
        
        return {};
    } catch (error) {
        console.error("❌ Error getting contract data:", error);
        if (error.response?.data) {
            console.error("❌ Error details:", error.response.data);
        }
        return {};
    }
}


function hexToSorobanAddress(hexString: string): string {
    const buffer = Buffer.from(hexString, 'hex');
    return StrKey.encodeContract(buffer);
}

async function initialize(): Promise<void> {
    logger.info("🚀 Initializing pairs...");
    const failedPairs: string[] = [];
    
    try {
        // Iterate over the list of pairs from the pairTokenRsv.ts file
        for (const [index, pair] of pairTokenReservesList.entries()) {
            try {
                // Check if a record already exists for this pair
                const existingPair = await Pair.get(pair.address);
                
                if (!existingPair) {
                    logger.info(`📊 Processing pair ${index + 1}/${pairTokenReservesList.length}: ${pair.address}`);
                    
                    // Create the initial record with all the information
                    const newPair = Pair.create({
                        id: pair.address,
                        ledger: 55735990 + index,
                        date: new Date(Date.now()),
                        tokenA: pair.token_a,
                        tokenB: pair.token_b,
                        reserveA: BigInt(pair.reserve_a),
                        reserveB: BigInt(pair.reserve_b)
                    });
                    
                    await newPair.save();
                    logger.info(`✨ Pair initialized: ${pair.address}`);

                    // Small pause between each pair
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                logger.error(`❌ Error initializing pair ${pair.address}: ${error}`);
                failedPairs.push(pair.address);
            }
        }
        
        // Final summary
        logger.info("\n📊 Initialization summary:");
        logger.info(`✅ Successfully processed pairs: ${pairTokenReservesList.length - failedPairs.length}`);
        if (failedPairs.length > 0) {
            logger.info(`❌ Pares with errors (${failedPairs.length}):`);
            failedPairs.forEach(pair => logger.info(`   - ${pair}`));
        }
        
    } catch (error) {
        logger.error("❌ General error in initialization:", error);
        throw error;
    }
    
    logger.info("✅ Initialization completed");
}

async function initializeAqua(): Promise<void> {
    logger.info("🚀 Initializing Aqua pools...");
    const failedPools: string[] = [];
    
    try {

        logger.info(`📊 Processing ${aquaPoolsList.length} Aqua pools...`);
        
        // Process in batches to avoid memory overload
        const batchSize = 20;
        for (let i = 0; i < aquaPoolsList.length; i += batchSize) {
            const batch = aquaPoolsList.slice(i, i + batchSize);
            
            // Create records for this batch
            const poolPromises = batch.map(async (pool, index) => {
                try {
                    // Verify if this pool already exists
                    const existingPool = await PairsAqua.get(pool.address);
                    if (existingPool) {
                        return null; // Already exists, do nothing
                    }
                    
                    // Create new record
                    const newPool = PairsAqua.create({
                        id: pool.address,
                        ledger: 0, // Will be updated with real events
                        date: new Date(),
                        address: pool.address,
                        tokenA: pool.tokenA,
                        tokenB: pool.tokenB,
                        poolType: '',
                        reserveA: BigInt(0), // Initialized in 0
                        reserveB: BigInt(0)  // Initialized in 0
                    });
                    
                    await newPool.save();
                    return pool.address;
                } catch (error) {
                    logger.error(`❌ Error initializing Aqua pool ${pool.address}: ${error}`);
                    failedPools.push(pool.address);
                    return null;
                }
            });
            
            // Wait for all operations in the batch to complete
            const results = await Promise.all(poolPromises);
            const successCount = results.filter(Boolean).length;
            
            logger.info(`✅ Procesado lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(aquaPoolsList.length/batchSize)}: ${successCount} pools guardados`);
            
            // Small pause between batches to avoid overload
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // For the final summary, simply count the successfully saved pools
        logger.info("\n📊 Summary of Aqua initialization:");
        logger.info(`✅ Pools processed successfully: ${aquaPoolsList.length - failedPools.length}`);
        if (failedPools.length > 0) {
            logger.info(`❌ Pools with errors (${failedPools.length}):`);
            failedPools.forEach(pool => logger.info(`   - ${pool}`));
        }
        
    } catch (error) {
        logger.error(`❌ General error initializing Aqua pools: ${error}`);
        throw error;
    }
    
    logger.info("✅ Aqua initialization completed");
}

// Extract reserves from a sync event and parse to bigint
function extractReserves(event: any): ReservesResult {
    let reserveA = BigInt(0);
    let reserveB = BigInt(0);

    // Check if we have the correct structure
    const values = event?.value?._value;
    if (!Array.isArray(values)) {
        logger.error('No reserves found');
        return { 
            reserveA, 
            reserveB 
        };
    }

    logger.info("\n🟣🟣🟣🟣 Processing reserves in extractReseves:");
    values.forEach((entry: any) => {
        try {
            logger.info("\n--- Processing entry ---");
            
            // Show full entry
            logger.info("🟣🟣🟣🟣 entry separated:");
            //logger.info(JSON.stringify(entry));

            // Get and show the key as buffer and text
            const keyBuffer = entry?._attributes?.key?._value?.data;
            if (!keyBuffer) {
                logger.info("❌🔴🔴 No keyBuffer found");
                return;
            }
            const keyText = Buffer.from(keyBuffer).toString();
            //logger.info('Key (Buffer):'+ JSON.stringify(entry._attributes.key));
            //logger.info('Key (Text):' + keyText);

            // Get and show the full value and its details
            const value = entry?._attributes?.val?._value?._attributes?.lo?._value;
            //logger.info('Val lo details:'+ JSON.stringify(entry._attributes.val._value._attributes.lo));
            
            if (!value) {
                logger.info("❌🔴🔴 No value found");
                return;
            }

            logger.info('✅ Final value found:' + value);

            // Assign the value according to the key
            if (keyText === 'new_reserve_0') {
                reserveA = BigInt(value);
                logger.info('→ Updated reserveA:' + reserveA.toString());
            } else if (keyText === 'new_reserve_1') {
                reserveB = BigInt(value);
                logger.info('→ Updated reserveB:' + reserveB.toString());
            }
        } catch (error) {
            logger.warn('❌🔴🔴 Error processing entry:', error);
        }
    });
    // debug log
    logger.info('\n🟣🟣🟣🟣 Final result:');
    logger.info(`reserveA: ${reserveA.toString()}`);
    logger.info(`reserveB: ${reserveB.toString()}`);

    return {
        reserveA,
        reserveB
    };
}

// function extractValuesNewPair(event: any): { tokenA: string, tokenB: string, address: string } {
//     let tokenA = '';
//     let tokenB = '';
//     let address = '';

//     // Extract the data from the event
//     const eventJson = JSON.stringify(event);
//     const eventParse = JSON.parse(eventJson);
//     const values = eventParse?.value?._value;

//     if (!Array.isArray(values)) {
//         logger.error('❌🔴🔴 No values array found in NewPair event');
//         return {
//             tokenA,
//             tokenB,
//             address
//         };
//     }

//     logger.info("\n🟣🟣🟣🟣 Processing NewPair event:");

//     values.forEach((entry: any) => {
//         try {
//             const keyBuffer = entry?._attributes?.key?._value?.data;
//             if (!keyBuffer) {
//                 logger.info("❌🔴🔴 No keyBuffer found");
//                 return;
//             }

//             const keyText = Buffer.from(keyBuffer).toString();
//             //logger.info('Key (Text):', keyText);

//             switch(keyText) {
//                 case 'token_0':
//                     const tokenABuffer = entry?._attributes?.val?._value?._value?.data;
//                     if (tokenABuffer) {
//                         const tokenAHex = Buffer.from(tokenABuffer).toString('hex');
//                         tokenA = hexToSorobanAddress(tokenAHex);
//                         //logger.info('→ Token A (hex):', tokenAHex);
//                         logger.info('→ Token A (Soroban):', tokenA);
//                     }
//                     break;
//                 case 'token_1':
//                     const tokenBBuffer = entry?._attributes?.val?._value?._value?.data;
//                     if (tokenBBuffer) {
//                         const tokenBHex = Buffer.from(tokenBBuffer).toString('hex');
//                         tokenB = hexToSorobanAddress(tokenBHex);
//                         //logger.info('→ Token B (hex):', tokenBHex);
//                         logger.info('→ Token B (Soroban):', tokenB);
//                     }
//                     break;
//                 case 'pair':
//                     const pairBuffer = entry?._attributes?.val?._value?._value?.data;
//                     if (pairBuffer) {
//                         const pairHex = Buffer.from(pairBuffer).toString('hex');
//                         address = hexToSorobanAddress(pairHex);
//                         //logger.info('→ Par (hex):', pairHex);
//                         logger.info('→ Par (Soroban):', address);
//                     }
//                     break;
//                 default:
//                     logger.info('⏩🔴🔴 Unrecognized key:', keyText);
//             }
//         } catch (error) {
//             logger.warn('❌🔴🔴 Error processing entry:', error);
//         }
//     });
//     // debug log
//     // logger.info('\n🟣🟣🟣🟣 Final result:');
//     // logger.info(`Token A: ${tokenA}`);
//     // logger.info(`Token B: ${tokenB}`);
//     // logger.info(`Pair address: ${address}`);
//     // logger.info(`New pairs length: ${newPairsLength}`);

//     if (!tokenA || !tokenB || !address) {
//         logger.error('❌🔴🔴 Incomplete data in NewPair event');
//     }

//     return {
//         tokenA,
//         tokenB,
//         address
//     };
// }

// Helper function para extraer valores del evento add_pool
function extractAddPoolAquaValues(event: any): {
    address: string;
    tokenA: string;
    tokenB: string;
    poolType: string;
} {
    let result = {
        address: '',
        tokenA: '',
        tokenB: '',
        poolType: ''
    };

    try {
        // Extraer user del value
        const values = event?.value?._value;
        if (!Array.isArray(values)) {
            throw new Error('No values array found in AddPool event');
        }

        logger.info("\n🔄 Processing Aqua AddPool event values:");

        // User address (primer valor del value)
        const userBuffer = values[0]?._value?._value?.data;
        if (userBuffer) {
            result.address = hexToSorobanAddress(Buffer.from(userBuffer).toString('hex'));
            logger.info(`→ User address: ${result.address}`);
        }
        // pool type
        const poolType = values[1]?._value?.data;
        if (poolType) {
            result.poolType = Buffer.from(poolType).toString('utf8');
            logger.info(`→ Pool type: ${result.poolType}`);
        }

        // Tokens del topic[1]
        const topicTokens = event?.topic?.[1]?._value;
        if (Array.isArray(topicTokens) && topicTokens.length >= 2) {
            // Token A
            const tokenABuffer = topicTokens[0]?._value?._value?.data;
            if (tokenABuffer) {
                result.tokenA = hexToSorobanAddress(Buffer.from(tokenABuffer).toString('hex'));
                logger.info(`→ Token A: ${result.tokenA}`);
            }

            // Token B
            const tokenBBuffer = topicTokens[1]?._value?._value?.data;
            if (tokenBBuffer) {
                result.tokenB = hexToSorobanAddress(Buffer.from(tokenBBuffer).toString('hex'));
                logger.info(`→ Token B: ${result.tokenB}`);
            }
        }

        if (!result.address || !result.tokenA || !result.tokenB) {
            throw new Error('Incomplete data in AddPool event');
        }

        return result;

    } catch (error) {
        logger.error(`❌ Error extracting Aqua AddPool values: ${error}`);
        logger.error('Event data was:', JSON.stringify(event, null, 2));
        throw error;
    }
}

// Function to get ledger key for contract instance
function getLedgerKeyContractCode(contractId: string): string {
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

    // // //  2. Test for error example with scValToNative
    // try {
    //     const test = scValToNative(event.value);
    //     logger.info("🔍 test:❌❌❌❌❌");
    //     logger.info(" test[0]: " + test[0]);
    //     logger.info(" test[1]: " + test[1]);
    //     logger.info(" test: " + test);
    // } catch (error) {
    //     logger.error("❌🔴🔴 Error processing Aqua deposit event: ${error}");
    //     throw error;
    // }





