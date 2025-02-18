import { Sync } from "../types";
import {
  SorobanEvent,
} from "@subql/types-stellar";
import { poolsList } from "./poolsList";
import { config } from 'dotenv';
import { poolReservesList } from "./poolRsvList";
import { NewPair } from "../types";

config();

let initialized = false;

// SYNC EVENTS
export async function handleEventSync(event: SorobanEvent): Promise<void> {
    if (!initialized) {
        await initializeSync();
        initialized = true;
    }

  logger.info(
    `New sync event found at block ${event.ledger.sequence.toString()}`
  );
   // Log para debug
    
    logger.info("🔵 Entrando al event sync")
    let eventJson = JSON.stringify(event);
    // logger.info("eventJson: " + eventJson);
    logger.info("🔵🔵")
    let eventParse = JSON.parse(eventJson);
    logger.info("eventParse: " + eventParse);


  logger.info("🔴🔴")

  // Verificar si el contrato está en la lista de tokens
  const contractId = event.contractId?.contractId().toString();
  if (!contractId || !poolsList.includes(contractId)) {
    logger.info(`🔴🔴 Error: Contrato ${contractId} no está en la lista de tokens permitidos`);
    return;
  }

  try { 
    // Extraer las reservas primero
    const { reserve0, reserve1 } = extractReserves(JSON.parse(JSON.stringify(event)));
    
    // Buscar todos los syncs existentes para este contrato
    const existingSyncs = await Sync.get(contractId);

    logger.info("existingSyncs: " + existingSyncs);
    logger.info("🔴🔴");
    logger.info(existingSyncs);
    logger.info("🔴🔴");
    const currentDate = new Date(event.ledgerClosedAt);
    
    // Crear el nuevo sync
    const newSync = Sync.create({
      id: contractId,
      ledger: event.ledger.sequence,
      date: currentDate,
      contract: contractId,
      newReserve0: reserve0,
      newReserve1: reserve1
    });
    
    // Primero verificamos si hay registros más antiguos antes de guardar el nuevo
    if (existingSyncs) {
          const oldDate = new Date(existingSyncs.date);
          
          if (oldDate < currentDate) {
            logger.info(`🗑️ Eliminando sync antiguo del contrato ${existingSyncs.id} con fecha ${oldDate}`);
            await Sync.remove(existingSyncs.id);
          } else {
            logger.info(`⏭️ El sync existente es más reciente (${oldDate}), no se actualiza`);
            return; // Salimos sin guardar el nuevo sync
          }
        }
      
    
    
    // Si llegamos aquí, guardamos el nuevo sync
    await newSync.save();
    logger.info(`✨ Actualizado sync para contrato ${contractId} con fecha ${currentDate}`);
    
  } catch (error) {
    logger.error(`❌ Error procesando sync event: ${error}`);
    throw error;
  }
}

export async function handleEventNewPair(event: SorobanEvent): Promise<void> {
    logger.info(
        `Nuevo evento NewPair encontrado en el bloque ${event.ledger.sequence.toString()}`
    );

    try {
        // Extraer los datos del evento
        const eventJson = JSON.stringify(event);
        const eventParse = JSON.parse(eventJson);
        const values = eventParse?.value?._value;

        if (!Array.isArray(values)) {
            logger.error('❌ No se encontró el array de valores en el evento NewPair');
            return;
        }

        let token0 = '';
        let token1 = '';
        let pair = '';
        let newPairsLength = 0;

        // Procesar cada valor del evento
        values.forEach((entry: any) => {
            const keyBuffer = entry?._attributes?.key?._value?.data;
            if (!keyBuffer) return;

            const keyText = Buffer.from(keyBuffer).toString();
            const value = entry?._attributes?.val?._value;

            switch(keyText) {
                case 'token_0':
                    token0 = value?.toString() || '';
                    break;
                case 'token_1':
                    token1 = value?.toString() || '';
                    break;
                case 'pair':
                    pair = value?.toString() || '';
                    break;
                case 'new_pairs_length':
                    newPairsLength = parseInt(value?._attributes?.lo?._value || '0');
                    break;
            }
        });

        // Verificar que tenemos todos los datos necesarios
        if (!token0 || !token1 || !pair || !newPairsLength) {
            logger.error('❌ Datos incompletos en el evento NewPair');
            return;
        }

        // Crear el nuevo registro
        const newPairEvent = NewPair.create({
            id: event.id,
            ledger: event.ledger.sequence,
            date: new Date(event.ledgerClosedAt),
            token0: token0,
            token1: token1,
            pair: pair,
            newPairsLength: newPairsLength
        });

        await newPairEvent.save();
        logger.info(`✅ Nuevo par guardado: ${pair} (${token0} - ${token1})`);

    } catch (error) {
        logger.error(`❌ Error procesando evento NewPair: ${error}`);
        throw error;
    }
}

//######################### HELPERS #########################

async function initializeSync(): Promise<void> {
  logger.info("🚀 Inicializando datos de sync...");
  const failedPools: string[] = [];
  
  try {
      for (const [index, contractId] of poolsList.entries()) {
          try {
              // Verificar si ya existe un sync para este contrato
              const existingSync = await Sync.get(contractId);
              if (!existingSync) {
                  logger.info(`📊 Procesando pool ${index + 1}/${poolsList.length}: ${contractId}`);
                  
                  // Obtener reservas actuales
                  const [reserve0, reserve1] = await getPoolReserves(contractId);
                  
                  if (reserve0 === BigInt(0) && reserve1 === BigInt(0)) {
                      failedPools.push(contractId);
                  }
                  
                  // Crear un sync inicial
                  const newSync = Sync.create({
                      id: contractId,
                      ledger: 55735990 + index,
                      date: new Date(Date.now()),
                      contract: contractId,
                      newReserve0: reserve0,
                      newReserve1: reserve1
                  });
                  
                  await newSync.save();
                  logger.info(`✨ Sync inicial creado para contrato ${contractId}`);
                  
                  // Pequeña pausa entre cada pool
                  await new Promise(resolve => setTimeout(resolve, 1000));
              }
          } catch (error) {
              logger.error(`❌ Error inicializando sync para ${contractId}: ${error}`);
              failedPools.push(contractId);
          }
      }
      
      // Resumen final
      logger.info("\n📊 Resumen de la inicialización:");
      logger.info(`✅ Pools procesados exitosamente: ${poolsList.length - failedPools.length}`);
      if (failedPools.length > 0) {
          logger.info(`❌ Pools con errores (${failedPools.length}):`);
          failedPools.forEach(pool => logger.info(`   - ${pool}`));
      }
      
  } catch (error) {
      logger.error("❌ Error general en inicialización:", error);
      throw error;
  }
  
  logger.info("✅ Inicialización completada");
}

// Función modificada para obtener las reservas desde poolRsvList
async function getPoolReserves(contractId: string): Promise<[bigint, bigint]> {
    try {
        // Buscar el pool en la lista de reservas
        const pool = poolReservesList.find(p => p.contract === contractId);
        
        if (!pool) {
            logger.warn(`⚠️ No se encontraron reservas para el pool ${contractId} en poolRsvList`);
            return [BigInt(0), BigInt(0)];
        }

        logger.info(`✅ Reservas encontradas para ${contractId}:`);
        logger.info(`Reserve0: ${pool.reserve0}`);
        logger.info(`Reserve1: ${pool.reserve1}`);

        return [BigInt(pool.reserve0), BigInt(pool.reserve1)];
        
    } catch (error) {
        logger.error(`❌ Error obteniendo reservas para ${contractId}: ${error}`);
        logger.warn(`⚠️ Usando valores por defecto para el pool ${contractId}`);
        
        return [BigInt(0), BigInt(0)];
    }
}

interface ReservesResult {
  reserve0: bigint;
  reserve1: bigint;
}
// Extraer reservas de un evento de sync y las parsear a bigint

function extractReserves(event: any): ReservesResult {
    let reserve0 = BigInt(0);
    let reserve1 = BigInt(0);

    // Verificar si tenemos la estructura correcta
    const values = event?.value?._value;
    if (!Array.isArray(values)) {
        logger.error('No se encontró el array de valores');
        return { 
            reserve0, 
            reserve1 
        };
    }

    logger.info("\n🟣🟣🟣🟣 Procesando reservas en extractReseves:");
    values.forEach((entry: any) => {
        try {
            logger.info("\n--- Procesando entrada ---");
            
            // Mostrar entrada completa
            logger.info("🔵🔵🔵 entry separado:");
            logger.info(JSON.stringify(entry));

            // Obtener y mostrar la key como buffer y texto
            const keyBuffer = entry?._attributes?.key?._value?.data;
            if (!keyBuffer) {
                logger.info("❌ No se encontró keyBuffer");
                return;
            }
            const keyText = Buffer.from(keyBuffer).toString();
            logger.info('Key (Buffer):'+ JSON.stringify(entry._attributes.key));
            logger.info('Key (Text):' + keyText);

            // Obtener y mostrar el valor completo y sus detalles
            const value = entry?._attributes?.val?._value?._attributes?.lo?._value;
            logger.info('Val lo details:'+ JSON.stringify(entry._attributes.val._value._attributes.lo));
            
            if (!value) {
                logger.info("❌ No se encontró valor");
                return;
            }

            logger.info('✅ Valor final encontrado:' + value);

            // Asignar el valor según la key
            if (keyText === 'new_reserve_0') {
                reserve0 = BigInt(value);
                logger.info('→ Actualizado reserve0:' + reserve0.toString());
            } else if (keyText === 'new_reserve_1') {
                reserve1 = BigInt(value);
                logger.info('→ Actualizado reserve1:' + reserve1.toString());
            }
        } catch (error) {
            logger.warn('❌ Error procesando entrada:', error);
        }
    });

    logger.info('\n🟣🟣🟣🟣 Resultado final:');
    logger.info(`reserve0: ${reserve0.toString()}`);
    logger.info(`reserve1: ${reserve1.toString()}`);

    return {
        reserve0,
        reserve1
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
