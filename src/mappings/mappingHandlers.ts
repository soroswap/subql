import { SorobanEvent } from "@subql/types-stellar";
import { initializeSoroswap } from "../soroswap/intialize";
import { soroswapNewPairHandler, soroswapSyncHandler } from "../soroswap";
import { phoenixHandler } from "../phoenix";
import { initializePhoenix } from "../phoenix/initialize";
import { initializeAquaDb } from "../aqua/initialize";
import { aquaEventHandler, aquaAddPoolHandler } from "../aqua";
import { hexToSorobanAddress } from "../utils";
import { Address, StrKey } from "@stellar/stellar-sdk";

// SOROSWAP SYNC EVENTS
export async function handleSoroswapEventSync(
  event: SorobanEvent
): Promise<void> {
  logger.info(`[SOROSWAP] 🔁 Sync event received`);
  await initializeSoroswap(event.contractId.toString());
  return await soroswapSyncHandler(event);
}

// SOROSWAP PAIR EVENTS
export async function handleSoroswapEventNewPair(
  event: SorobanEvent
): Promise<void> {
  logger.info(`[SOROSWAP] 🔁 NewPair event received`);
  await initializeSoroswap(event.contractId.toString());
  return await soroswapNewPairHandler(event);
}

// PHOENIX EVENTS
export async function handlePhoenixEvent(event: SorobanEvent): Promise<void> {
  logger.info(
    `[PHOENIX] 🔁 ${String(
      event.topic[0]?.value()
    ).toUpperCase()} Event received`
  );
  await initializePhoenix(event.contractId.toString());
  return await phoenixHandler(event);
}

export async function handlePhoenixCreateLPEvent(
  event: SorobanEvent
): Promise<void> {
  logger.info(`[PHOENIX] 🔁 Create LP Event received`);
  // TODO: Create lp handler
}

// AQUA SWAP LIQUIDITY EVENTS
export async function handleEventAqua(event: SorobanEvent): Promise<void> {
  logger.info(
    `[AQUA] 🔁 ${String(event.topic[0]?.value()).toUpperCase()} Event received`
  );
  
  // Extraer correctamente el valor de la dirección del trader (topic[3])
  let traderAddress = "";
  
  if (event.topic[3]) {
    try {
      // Verificar si es una dirección ScVal
      if (event.topic[3].switch().name === "scvAddress") {
        // Obtener el objeto de dirección
        const addressObj = event.topic[3].address();
        
        // Verificar si es una dirección de contrato
        if (addressObj.switch().name === "scAddressTypeContract") {
          // Obtener el ID del contrato como Buffer
          const contractIdBuffer = addressObj.contractId();
          // Convertir a formato C... usando StrKey
          traderAddress = StrKey.encodeContract(contractIdBuffer);
          logger.info(`Trader es un contrato: ${traderAddress}`);
        } 
        // Si es una dirección de cuenta
        else if (addressObj.switch().name === "scAddressTypeAccount") {
          // Obtener la clave pública como Buffer
          const publicKeyBuffer = addressObj.accountId().ed25519();
          // Convertir a formato G... usando StrKey
          traderAddress = StrKey.encodeEd25519PublicKey(publicKeyBuffer);
          logger.info(`Trader es una cuenta: ${traderAddress}`);
        }
      }
    } catch (error) {
      logger.error(`Error al procesar la dirección del trader: ${error}`);
    }
  }
  
  // Verificar si es un evento TRADE y si el trader es la dirección específica
  const eventType = String(event.topic[0]?.value()).toUpperCase();
  const targetAddress = "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK";
  
  logger.info(`Comparando direcciones: ${traderAddress} con ${targetAddress}`);
  
  // Inicializar AQUA DB para el evento TRADE si coincide con la dirección objetivo
  if (eventType === "TRADE" && traderAddress === targetAddress) {
    logger.info(`Inicializando AQUA DB para trader específico: ${traderAddress}`);
    await initializeAquaDb(event.contractId.toString());
  }
  
  return await aquaEventHandler(event);
}

// AQUA ADD POOL EVENTS
export async function handleEventAddPoolAqua(
  event: SorobanEvent
): Promise<void> {
  logger.info(`[AQUA] 🔄 add pool event received`);
  //await initializeAquaDb(event.contractId.toString());
  return await aquaAddPoolHandler(event);
}
