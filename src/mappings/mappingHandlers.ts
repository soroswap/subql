import { Account, Transfer, Sync } from "../types";
import {
  StellarOperation,
  StellarEffect,
  SorobanEvent,
} from "@subql/types-stellar";
import {
  AccountCredited,
  AccountDebited,
} from "@stellar/stellar-sdk/lib/horizon/types/effects";
import { Horizon, scValToNative } from "@stellar/stellar-sdk";
import { Address, xdr } from "@stellar/stellar-sdk";
import * as fs from 'fs';
import * as path from 'path';

export async function handleEvent(event: SorobanEvent): Promise<void> {
  logger.info(
    `New transfer event found at block ${event.ledger.sequence.toString()}`
  );

  // Get data from the event
  // The transfer event has the following payload \[env, from, to\]
  // logger.info(JSON.stringify(event));
  const {
    topic: [env, from, to],
  } = event;

  try {
    decodeAddress(from);
    decodeAddress(to);
  } catch (e) {
    logger.info(`decode address failed`);
  }

  const fromAccount = await checkAndGetAccount(
    decodeAddress(from),
    event.ledger.sequence
  );
  const toAccount = await checkAndGetAccount(
    decodeAddress(to),
    event.ledger.sequence
  );

  // Create the new transfer entity
  const transfer = Transfer.create({
    id: event.id,
    ledger: event.ledger.sequence,
    date: new Date(event.ledgerClosedAt),
    contract: event.contractId?.contractId().toString()!,
    fromId: fromAccount.id,
    toId: toAccount.id,
    value: BigInt(scValToNative(event.value)),
  });

  fromAccount.lastSeenLedger = event.ledger.sequence;
  toAccount.lastSeenLedger = event.ledger.sequence;
  await Promise.all([fromAccount.save(), toAccount.save(), transfer.save()]);
}



// SYNC EVENTS


export async function handleEventSync(event: SorobanEvent): Promise<void> {
  logger.info(
    `New sync event found at block ${event.ledger.sequence.toString()}`
  );
   // Log para debug
    
    logger.info("🔵")
    // logger.info("🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣")
    let eventJson = JSON.stringify(event);
    // logger.info("eventJson: " + eventJson);
    // logger.info("🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣")
    logger.info("🔵🔵")
    let eventParse = JSON.parse(eventJson);
    logger.info("eventParse: " + eventParse);
    // logger.info("event.value.value(): " + JSON.stringify(event.value.value()));
    // logger.info("event.ledger.txhash: " + event.ledger.txHash)

    // const scvalue = scValToNative(event.value);
    // console.log("eventData: " + scvalue);

  logger.info("🔴🔴🔴🔴")

  try {
    // Extraer las reservas usando la función
    const { reserve0, reserve1 } = extractReserves(eventParse);
    logger.info("🟣 Reservas extraídas");

    // Crear la nueva entidad sync
    const sync = Sync.create({
      id: `${event.id}-${event.ledger.sequence}`,
      ledger: event.ledger.sequence,
      date: new Date(event.ledgerClosedAt),
      contract: event.contractId?.contractId().toString()!,
      newReserve0: reserve0,
      newReserve1: reserve1
    });
    logger.info("🟢 Entidad sync creada");

    await sync.save();
    logger.info(`Saved sync entity with id: ${sync.id}`);
    
  } catch (error) {
    logger.error("Error processing sync event: " + error);
    logger.error("Event value: " + JSON.stringify(event.value));
    throw error;
  }
}

// HELPERS


async function checkAndGetAccount(
  id: string,
  ledgerSequence: number
): Promise<Account> {
  let account = await Account.get(id.toLowerCase());
  if (!account) {
    // We couldn't find the account
    account = Account.create({
      id: id.toLowerCase(),
      firstSeenLedger: ledgerSequence,
    });
  }
  return account;
}

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

    logger.info("\n🟣🟣🟣🟣 Procesando reservas:");
    values.forEach((entry: any) => {
        try {
            logger.info("\n--- Procesando entrada ---");
            
            // Mostrar entrada completa
            logger.info("🔵🔵 entry separado:");
            logger.info(JSON.stringify(entry));
            logger.info("entry a secas:" + entry)
            logger.info(entry)
            logger.info("🔵🔵🔵")
            logger.info(entry._attributes.val._value)

            // Obtener y mostrar la key como buffer y texto
            const keyBuffer = entry?._attributes?.key?._value?.data;
            if (!keyBuffer) {
                logger.info("❌ No se encontró keyBuffer");
                return;
            }
            const keyText = Buffer.from(keyBuffer).toString();
            logger.info('Key (Buffer):', JSON.stringify(entry._attributes.key));
            logger.info('Key (Text):', keyText);

            // Obtener y mostrar el valor completo y sus detalles
            logger.info('Val completo:', JSON.stringify(entry._attributes.val));
            const value = entry?._attributes?.val?._value?._attributes?.lo?._value;
            logger.info('Val lo details:', JSON.stringify(entry._attributes.val._value._attributes.lo));
            
            if (!value) {
                logger.info("❌ No se encontró valor");
                return;
            }

            logger.info('✅ Valor final encontrado:', value);

            // Asignar el valor según la key
            if (keyText === 'new_reserve_0') {
                reserve0 = BigInt(value);
                logger.info('→ Actualizado reserve0:', reserve0.toString());
            } else if (keyText === 'new_reserve_1') {
                reserve1 = BigInt(value);
                logger.info('→ Actualizado reserve1:', reserve1.toString());
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