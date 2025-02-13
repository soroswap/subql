import { Sync } from "../types";
import {
  SorobanEvent,
} from "@subql/types-stellar";
import { Address, xdr } from "@stellar/stellar-sdk";
import * as fs from 'fs';
import * as path from 'path';
import { tokenList } from "./tokenlist";

// SYNC EVENTS
export async function handleEventSync(event: SorobanEvent): Promise<void> {
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
  if (!contractId || !tokenList.includes(contractId)) {
    logger.info(`🔴🔴 Error: Contrato ${contractId} no está en la lista de tokens permitidos`);
    return;
  }

  try { 
    // Buscar sync existente para este contrato
    const existingSync = await getLastSyncByContract(contractId);
    
    // Extraer las reservas
    const { reserve0, reserve1 } = extractReserves(JSON.parse(JSON.stringify(event)));
    if (existingSync) {
      // Actualizar el sync existente
      existingSync.ledger = event.ledger.sequence;
      existingSync.date = new Date(event.ledgerClosedAt);
      existingSync.newReserve0 = reserve0;
      existingSync.newReserve1 = reserve1;
      
      await existingSync.save();
      logger.info(`📝 Actualizado sync existente para contrato ${contractId}`);
    } else {
      // Crear nuevo sync
      const sync = Sync.create({
        id: contractId, // Usar contractId como id para asegurar un único registro por contrato
        ledger: event.ledger.sequence,
        date: new Date(event.ledgerClosedAt),
        contract: contractId,
        newReserve0: reserve0,
        newReserve1: reserve1
      });
      
      await sync.save();
      logger.info(`✨ Creado nuevo sync para contrato ${contractId}`);
    }
    
  } catch (error) {
    logger.error(`❌ Error procesando sync event: ${error}`);
    throw error;
  }
}

//######################### HELPERS #########################


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
function decodeAddress(scVal: xdr.ScVal): string {
  try {
    return Address.account(scVal.address().accountId().ed25519()).toString();
  } catch (e) {
    return Address.contract(scVal.address().contractId()).toString();
  }
}
interface ReservesResult {
    reserve0: bigint;
    reserve1: bigint;
}

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

async function getLastSyncByContract(contractId: string): Promise<Sync | undefined> {
  try {
    logger.info(`🔍 Buscando último sync para contrato ${contractId}`);
    
    // Buscar el sync existente para este contrato
    const existingSync = await Sync.get(contractId);
    
    if (existingSync) {
      logger.info(`✅ Sync encontrado para contrato ${contractId}: Ledger ${existingSync.ledger}`);
      return existingSync;
    }

    logger.info(`ℹ️ No se encontraron syncs previos para el contrato ${contractId}`);
    return undefined;
  } catch (error) {
    logger.error(`❌ Error al buscar último sync para contrato ${contractId}: ${error}`);
    return undefined;
  }
}