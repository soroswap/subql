import {
  SorobanEvent,
} from "@subql/types-stellar";
import { config } from 'dotenv';
import { StrKey } from '@stellar/stellar-sdk';
import { pairTokenReservesList } from "./pairTokenRsv";
import { aquaPoolsList } from "./aquaPools";
import { Pair, PairsAqua } from "../types";

config();

let initialized = false;
let aquaInitialized = false;
interface ReservesResult {
    reserveA: bigint;
    reserveB: bigint;
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

        // Actualizar solo las reservas y la fecha
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

        // Crear nuevo par o actualizar si existe
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

        // Buscar si existe un registro previo para este usuario
        const existingPool = await PairsAqua.get(eventData.address);
        
        // Si existe un registro más reciente, no actualizamos
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
            reserveA: BigInt(0), // Inicializado en 0
            reserveB: BigInt(0)  // Inicializado en 0
        });

        await pairAqua.save();
        logger.info(`✅ Pool event created/updated for address: ${eventData.address}`);

    } catch (error) {
        logger.error(`❌ Error processing Aqua Pool event: ${error}`);
        throw error;
    }
}

//######################### HELPERS #########################

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
        // Eliminamos la verificación inicial ya que es un proceso de inicialización
        // y asumimos que la base de datos está vacía

        logger.info(`📊 Procesando ${aquaPoolsList.length} pools de Aqua...`);
        
        // Procesar en lotes para evitar sobrecarga de memoria
        const batchSize = 20;
        for (let i = 0; i < aquaPoolsList.length; i += batchSize) {
            const batch = aquaPoolsList.slice(i, i + batchSize);
            
            // Crear registros para este lote
            const poolPromises = batch.map(async (pool, index) => {
                try {
                    // Verificar si ya existe este pool
                    const existingPool = await PairsAqua.get(pool.address);
                    if (existingPool) {
                        return null; // Ya existe, no hacer nada
                    }
                    
                    // Crear nuevo registro
                    const newPool = PairsAqua.create({
                        id: pool.address,
                        ledger: 0, // Se actualizará con eventos reales
                        date: new Date(),
                        address: pool.address,
                        tokenA: pool.tokenA,
                        tokenB: pool.tokenB,
                        reserveA: BigInt(0), // Inicializado en 0
                        reserveB: BigInt(0)  // Inicializado en 0
                    });
                    
                    await newPool.save();
                    return pool.address;
                } catch (error) {
                    logger.error(`❌ Error inicializando Aqua pool ${pool.address}: ${error}`);
                    failedPools.push(pool.address);
                    return null;
                }
            });
            
            // Esperar a que se completen todas las operaciones del lote
            const results = await Promise.all(poolPromises);
            const successCount = results.filter(Boolean).length;
            
            logger.info(`✅ Procesado lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(aquaPoolsList.length/batchSize)}: ${successCount} pools guardados`);
            
            // Pequeña pausa entre lotes para evitar sobrecarga
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Para el resumen final, simplemente contamos los pools guardados exitosamente
        logger.info("\n📊 Resumen de inicialización de Aqua:");
        logger.info(`✅ Pools procesados exitosamente: ${aquaPoolsList.length - failedPools.length}`);
        if (failedPools.length > 0) {
            logger.info(`❌ Pools con errores (${failedPools.length}):`);
            failedPools.forEach(pool => logger.info(`   - ${pool}`));
        }
        
    } catch (error) {
        logger.error(`❌ Error general inicializando Aqua pools: ${error}`);
        throw error;
    }
    
    logger.info("✅ Inicialización de Aqua completada");
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

function hexToSorobanAddress(hexString: string): string {
    const buffer = Buffer.from(hexString, 'hex');
    return StrKey.encodeContract(buffer);
}

function extractValuesNewPair(event: any): { tokenA: string, tokenB: string, address: string } {
    let tokenA = '';
    let tokenB = '';
    let address = '';

    // Extract the data from the event
    const eventJson = JSON.stringify(event);
    const eventParse = JSON.parse(eventJson);
    const values = eventParse?.value?._value;

    if (!Array.isArray(values)) {
        logger.error('❌🔴🔴 No values array found in NewPair event');
        return {
            tokenA,
            tokenB,
            address
        };
    }

    logger.info("\n🟣🟣🟣🟣 Processing NewPair event:");

    values.forEach((entry: any) => {
        try {
            const keyBuffer = entry?._attributes?.key?._value?.data;
            if (!keyBuffer) {
                logger.info("❌🔴🔴 No keyBuffer found");
                return;
            }

            const keyText = Buffer.from(keyBuffer).toString();
            //logger.info('Key (Text):', keyText);

            switch(keyText) {
                case 'token_0':
                    const tokenABuffer = entry?._attributes?.val?._value?._value?.data;
                    if (tokenABuffer) {
                        const tokenAHex = Buffer.from(tokenABuffer).toString('hex');
                        tokenA = hexToSorobanAddress(tokenAHex);
                        //logger.info('→ Token A (hex):', tokenAHex);
                        logger.info('→ Token A (Soroban):', tokenA);
                    }
                    break;
                case 'token_1':
                    const tokenBBuffer = entry?._attributes?.val?._value?._value?.data;
                    if (tokenBBuffer) {
                        const tokenBHex = Buffer.from(tokenBBuffer).toString('hex');
                        tokenB = hexToSorobanAddress(tokenBHex);
                        //logger.info('→ Token B (hex):', tokenBHex);
                        logger.info('→ Token B (Soroban):', tokenB);
                    }
                    break;
                case 'pair':
                    const pairBuffer = entry?._attributes?.val?._value?._value?.data;
                    if (pairBuffer) {
                        const pairHex = Buffer.from(pairBuffer).toString('hex');
                        address = hexToSorobanAddress(pairHex);
                        //logger.info('→ Par (hex):', pairHex);
                        logger.info('→ Par (Soroban):', address);
                    }
                    break;
                default:
                    logger.info('⏩🔴🔴 Unrecognized key:', keyText);
            }
        } catch (error) {
            logger.warn('❌🔴🔴 Error processing entry:', error);
        }
    });
    // debug log
    // logger.info('\n🟣🟣🟣🟣 Final result:');
    // logger.info(`Token A: ${tokenA}`);
    // logger.info(`Token B: ${tokenB}`);
    // logger.info(`Pair address: ${address}`);
    // logger.info(`New pairs length: ${newPairsLength}`);

    if (!tokenA || !tokenB || !address) {
        logger.error('❌🔴🔴 Incomplete data in NewPair event');
    }

    return {
        tokenA,
        tokenB,
        address
    };
}

// Helper function para extraer valores del evento add_pool
function extractAddPoolAquaValues(event: any): {
    address: string;
    tokenA: string;
    tokenB: string;
} {
    let result = {
        address: '',
        tokenA: '',
        tokenB: ''
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

// // extract values from swapAqua event   
// function extractSwapAquaValues(event: any): {
//     user: string,
//     tokenIn: string,
//     tokenOut: string,
//     inAmount: bigint,
//     outMin: bigint
// } {
//     let result = {
//         user: '',
//         tokenIn: '',
//         tokenOut: '',
//         inAmount: BigInt(0),
//         outMin: BigInt(0)
//     };

//     try {
//         // Extraer los valores del evento
//         const values = event?.value?._value;
//         if (!Array.isArray(values)) {
//             logger.error('❌ Event structure is not as expected. Event value:', JSON.stringify(event?.value));
//             throw new Error('No values array found in Swap event');
//         }

//         logger.info("\n🔄 Processing Aqua Swap event values:");

//         // Los primeros tres valores son direcciones (user, tokenIn, tokenOut)
//         if (values.length >= 3) {
//             // User address (primer valor)
//             const userBuffer = values[0]?._arm === 'address' ? 
//                 values[0]?._value?._value?.data : null;
//             if (userBuffer) {
//                 result.user = hexToSorobanAddress(Buffer.from(userBuffer).toString('hex'));
//                 logger.info(`→ User address: ${result.user}`);
//             }

//             // Token In (segundo valor)
//             const tokenInBuffer = values[1]?._arm === 'address' ? 
//                 values[1]?._value?._value?.data : null;
//             if (tokenInBuffer) {
//                 result.tokenIn = hexToSorobanAddress(Buffer.from(tokenInBuffer).toString('hex'));
//                 logger.info(`→ Token In: ${result.tokenIn}`);
//             }

//             // Token Out (tercer valor)
//             const tokenOutBuffer = values[2]?._arm === 'address' ? 
//                 values[2]?._value?._value?.data : null;
//             if (tokenOutBuffer) {
//                 result.tokenOut = hexToSorobanAddress(Buffer.from(tokenOutBuffer).toString('hex'));
//                 logger.info(`→ Token Out: ${result.tokenOut}`);
//             }

//             // In Amount (cuarto valor)
//             const inAmount = values[3]?._arm === 'u128' ? 
//                 values[3]?._value?._attributes?.lo?._value : null;
//             if (inAmount) {
//                 result.inAmount = BigInt(inAmount);
//                 logger.info(`→ In Amount: ${result.inAmount.toString()}`);
//             }

//             // Out Min (quinto valor)
//             const outMin = values[4]?._arm === 'u128' ? 
//                 values[4]?._value?._attributes?.lo?._value : null;
//             if (outMin) {
//                 result.outMin = BigInt(outMin);
//                 logger.info(`→ Out Min: ${result.outMin.toString()}`);
//             }
//         }

//         // Verificación más flexible
//         if (!result.user || !result.tokenIn || !result.tokenOut) {
//             throw new Error('No data could be extracted from the Swap event');
//         }

//         return result;

//     } catch (error) {
//         logger.error(`❌ Error extracting Aqua Swap values: ${error}`);
//         logger.error('Event data was:', JSON.stringify(event, null, 2));
//         throw error;
//     }
// }



// // Function to extract values from depositAqua event
// function extractDepositAquaValues(event: any): {
//     user: string,
//     tokenIn: string,
//     tokenOut: string,
//     inAmount: bigint,
//     outMin: bigint
// } {
//     let result = {
//         user: '',
//         tokenIn: '',
//         tokenOut: '',
//         inAmount: BigInt(0),
//         outMin: BigInt(0)
//     };

//     try {
//         const values = event?.value?._value;
//         if (!Array.isArray(values)) {
//             logger.error('❌ Event structure is not as expected. Event value:', JSON.stringify(event?.value));
//             throw new Error('No values array found in Deposit event');
//         }

//         logger.info("\n🔄 Processing Aqua Deposit event values:");

//         // Los primeros valores son direcciones (user y tokens)
//         if (values.length >= 2) {
//             // User address (primer valor)
//             const userBuffer = values[0]?._arm === 'address' ? 
//                 values[0]?._value?._value?._value?.data : null;
//             if (userBuffer) {
//                 result.user = hexToSorobanAddress(Buffer.from(userBuffer).toString('hex'));
//                 logger.info(`→ User address: ${result.user}`);
//             }

//             // Tokens (segundo valor es un vector de addresses)
//             const tokens = values[1]?._value;
//             if (Array.isArray(tokens) && tokens.length >= 2) {
//                 // Token In (primer token)
//                 const tokenInBuffer = tokens[0]?._value?._value?._value?.data;
//                 if (tokenInBuffer) {
//                     result.tokenIn = hexToSorobanAddress(Buffer.from(tokenInBuffer).toString('hex'));
//                     logger.info(`→ Token In: ${result.tokenIn}`);
//                 }

//                 // Token Out (segundo token)
//                 const tokenOutBuffer = tokens[1]?._value?._value?._value?.data;
//                 if (tokenOutBuffer) {
//                     result.tokenOut = hexToSorobanAddress(Buffer.from(tokenOutBuffer).toString('hex'));
//                     logger.info(`→ Token Out: ${result.tokenOut}`);
//                 }
//             }

//             // Desired amounts (cuarto valor es un vector de u128)
//             const desiredAmounts = values[3]?._value;
//             if (Array.isArray(desiredAmounts) && desiredAmounts.length >= 1) {
//                 const inAmount = desiredAmounts[0]?._value?._attributes?.lo?._value;
//                 if (inAmount) {
//                     result.inAmount = BigInt(inAmount);
//                     logger.info(`→ In Amount: ${result.inAmount.toString()}`);
//                 }
//             }

//             // Min shares (quinto valor)
//             const minShares = values[4]?._value?._attributes?.lo?._value;
//             if (minShares) {
//                 result.outMin = BigInt(minShares);
//                 logger.info(`→ Min Shares: ${result.outMin.toString()}`);
//             }
//         }

//         // Verificación más flexible
//         if (!result.user || !result.tokenIn || !result.tokenOut) {
//             throw new Error('No data could be extracted from the Deposit event');
//         }

//         return result;

//     } catch (error) {
//         logger.error(`❌ Error extracting Aqua Deposit values: ${error}`);
//         logger.error('Event data was:', JSON.stringify(event, null, 2));
//         throw error;
//     }
// }






