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
   logger.info("############ EVENT ###########################" + JSON.stringify(event));
   logger.info("############ VALUE ###########################" + JSON.stringify(event.value));
   // saveEventToFile(event);
  
   // Helper extractReserves or scvaltonative
    // Extract event data with scvaltonative simple
    logger.info("event: " + event);
    logger.info("event.value: " + event.value);
    logger.info("event.value.value(): " + event.value.value());

    // const eventData = scValToNative(event.value);
    // console.log("eventData: " + eventData);

  logger.info("🔴🔴🔴🔴")
  try {
    // Extraer las reservas usando la nueva función
    const { reserve0, reserve1 } = extractReserves(event);
    logger.info("🟣")

    // Crear la nueva entidad sync
    const sync = Sync.create({
      id: `${event.id}-${event.ledger.sequence}`,
      ledger: event.ledger.sequence,
      date: new Date(event.ledgerClosedAt),
      contract: event.contractId?.contractId().toString()!,
      newReserve0: reserve0,
      newReserve1: reserve1
    });
    logger.info("🟢")

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
// function saveEventToFile(event: SorobanEvent): void {
//   try {
//     const dirPath = path.join(process.cwd(), 'test_jsons');
//     if (!fs.existsSync(dirPath)) {
//         fs.mkdirSync(dirPath, { recursive: true });
//     }

//     // Guardar el evento completo
//     fs.writeFileSync(
//         path.join(dirPath, 'event.json'),
//         JSON.stringify(event, null, 2)
//     );

//     // Guardar solo el valor del evento
//     if (event.value) {
//         fs.writeFileSync(
//             path.join(dirPath, 'value.json'),
//             JSON.stringify(event.value, null, 2)
//         );
//     }
// } catch (error) {
//     console.error('Error al guardar el evento:', error);
// }

function extractReserves(event: any): { reserve0: bigint, reserve1: bigint } {
    let reserve0 = BigInt(0);
    let reserve1 = BigInt(0);

    // Verificar si tenemos la estructura correcta
    const values = event?.value?._value
    logger.info("############ VALUES #######################" + JSON.stringify(values));
    logger.info("🟢🔵value.value json"+ JSON.stringify(event.value.value()))
    const values2 = event.value.value()
    for (const value of values2) {
        logger.info("🟢value.value"+ JSON.stringify(value))
    }
    if (!Array.isArray(values)) {
        logger.error('No se encontró el array de valores');
        return { reserve0, reserve1 };
    }

    // Recorrer los valores buscando las reservas
    values.forEach((entry: any) => {
        logger.info("🟢🟢🟢🟢" + JSON.stringify(entry))
        logger.info("🟢🟢" + entry)
        try {
            // Obtener la key (nombre) del valor
            const keyBuffer = entry?._attributes?.key?._value?.data;
            if (!keyBuffer) 
              {logger.error('No se encontró el buffer de la key');
              return;}

            // Convertir el buffer a string
            const keyString = Buffer.from(keyBuffer).toString();
            logger.debug('Key encontrada:', keyString);

            // Obtener el valor numérico
            const value = entry?._attributes?.val?._value?._attributes?.lo?._value;
            if (!value) return;

            logger.debug('Valor encontrado para', keyString + ':', value);

            // Asignar el valor según la key
            if (keyString === 'new_reserve_0') {
                reserve0 = BigInt(value);
            } else if (keyString === 'new_reserve_1') {
                reserve1 = BigInt(value);
            }
        } catch (error) {
            logger.warn('Error procesando entrada:', error);
        }
    });

        logger.info('Reservas extraídas:', {
        reserve0: reserve0.toString(),
        reserve1: reserve1.toString()
    });

    return { reserve0, reserve1 };
}