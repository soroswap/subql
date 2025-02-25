//import { Sync } from "../types";
import {
  SorobanEvent,
} from "@subql/types-stellar";
import { poolsList } from "./poolsList";
import { config } from 'dotenv';
import { poolReservesList } from "./poolRsvList";
//import { NewPair } from "../types";
import { StrKey } from '@stellar/stellar-sdk';
import { pairTokenReservesList } from "./pairTokenRsv";
import { Pair } from "../types";

config();

let initialized = false;

// SYNC EVENTS
export async function handleEventSync(event: SorobanEvent): Promise<void> {
    if (!initialized) {
        await initialize();
        initialized = true;
    }

    const address = event.contractId?.contractId().toString();
    if (!address || !poolsList.includes(address)) {
        logger.info(`🔴🔴🔴🔴 Error: Contract ${address} is not in allowed tokens list`);
        return;
    }

    try { 
        const { reserveA, reserveB } = extractReserves(JSON.parse(JSON.stringify(event)));
        
        // Buscar el par existente
        const pair = await Pair.get(address);
        if (!pair) {
            logger.error(`No se encontró el par para la dirección ${address}`);
            return;
        }

        const currentDate = new Date(event.ledgerClosedAt);
        if (new Date(pair.date) > currentDate) {
            logger.info(`⏭️ Existing data is more recent, NOT updating`);
            return;
        }

        // Actualizar solo las reservas y la fecha
        pair.reserveA = reserveA;
        pair.reserveB = reserveB;
        pair.date = currentDate;
        pair.ledger = event.ledger.sequence;

        await pair.save();
        logger.info(`✨ Updated reserves for pair ${address}`);
        
    } catch (error) {
        logger.error(`❌🔴🔴 Error processing sync event: ${error}`);
        throw error;
    }
}

export async function handleEventNewPair(event: SorobanEvent): Promise<void> {
    if (!initialized) {
        await initialize();
        initialized = true;
    }

    try {
        const { tokenA, tokenB, address, newPairsLength } = extractValuesNewPair(JSON.parse(JSON.stringify(event)));

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
            address: address,
            newPairsLength: newPairsLength,
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

//######################### HELPERS #########################

async function initialize(): Promise<void> {
    logger.info("🚀 Inicializando pares...");
    const failedPairs: string[] = [];
    
    try {
        // Iteramos sobre la lista de pares del archivo pairTokenRsv.ts
        for (const [index, pair] of pairTokenReservesList.entries()) {
            try {
                // Verificamos si ya existe un registro para este par
                const existingPair = await Pair.get(pair.address);
                
                if (!existingPair) {
                    logger.info(`📊 Procesando par ${index + 1}/${pairTokenReservesList.length}: ${pair.address}`);
                    
                    // Creamos el registro inicial con toda la información
                    const newPair = Pair.create({
                        id: pair.address,
                        ledger: 55735990 + index,
                        date: new Date(Date.now()),
                        tokenA: pair.token_a,
                        tokenB: pair.token_b,
                        address: pair.address,
                        newPairsLength: index + 1,
                        reserveA: BigInt(pair.reserve_a),
                        reserveB: BigInt(pair.reserve_b)
                    });
                    
                    await newPair.save();
                    logger.info(`✨ Par inicializado: ${pair.address}`);
                    
                    // Pequeña pausa entre cada par
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                logger.error(`❌ Error inicializando par ${pair.address}: ${error}`);
                failedPairs.push(pair.address);
            }
        }
        
        // Resumen final
        logger.info("\n📊 Resumen de inicialización:");
        logger.info(`✅ Pares procesados exitosamente: ${pairTokenReservesList.length - failedPairs.length}`);
        if (failedPairs.length > 0) {
            logger.info(`❌ Pares con errores (${failedPairs.length}):`);
            failedPairs.forEach(pair => logger.info(`   - ${pair}`));
        }
        
    } catch (error) {
        logger.error("❌ Error general en la inicialización:", error);
        throw error;
    }
    
    logger.info("✅ Inicialización completada");
}

// Modified function to get reserves from poolRsvList
async function getPoolReserves(contractId: string): Promise<[bigint, bigint]> {
    try {
        // Search for the pool in the reserves list
        const pool = poolReservesList.find(p => p.contract === contractId);
        
        if (!pool) {
            logger.warn(`⚠️ No reserves found for pool ${contractId} in poolRsvList`);
            return [BigInt(0), BigInt(0)];
        }

        logger.info(`✅ Reserves found for ${contractId}:`);
        logger.info(`Reserve0: ${pool.reserve0}`);
        logger.info(`Reserve1: ${pool.reserve1}`);

        return [BigInt(pool.reserve0), BigInt(pool.reserve1)];
        
    } catch (error) {
        logger.error(`❌🔴🔴 Error getting reserves for ${contractId}: ${error}`);
        logger.warn(`⚠️ Using default values for pool ${contractId}`);
        
        return [BigInt(0), BigInt(0)];
    }
}

interface ReservesResult {
  reserveA: bigint;
  reserveB: bigint;
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

function extractValuesNewPair(event: any): { tokenA: string, tokenB: string, address: string, newPairsLength: number } {
    let tokenA = '';
    let tokenB = '';
    let address = '';
    let newPairsLength = 0;

    // Extract the data from the event
    const eventJson = JSON.stringify(event);
    const eventParse = JSON.parse(eventJson);
    const values = eventParse?.value?._value;

    if (!Array.isArray(values)) {
        logger.error('❌🔴🔴 No values array found in NewPair event');
        return {
            tokenA,
            tokenB,
            address,
            newPairsLength
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
                case 'new_pairs_length':
                    newPairsLength = parseInt(entry?._attributes?.val?._value || '0');
                    logger.info('→ New pairs length updated:', newPairsLength);
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

    if (!tokenA || !tokenB || !address || !newPairsLength) {
        logger.error('❌🔴🔴 Incomplete data in NewPair event');
    }

    return {
        tokenA,
        tokenB,
        address,
        newPairsLength
    };
}

// async function checkAndGetAccount(
//   id: string,
//   ledgerSequence: number
// ): Promise<Account> {
//   let account = await Account.get(id.toLowerCase());
//   if (!account) {
//     // We couldn't find the account
//     account = Account.create({
//       id: id.toLowerCase(),
//       firstSeenLedger: ledgerSequence,
//     });
//   }
//   return account;
// }

// scValToNative not works, temp solution
// function decodeAddress(scVal: xdr.ScVal): string {
//   try {
//     return Address.account(scVal.address().accountId().ed25519()).toString();
//   } catch (e) {
//     return Address.contract(scVal.address().contractId()).toString();
//   }
// }

