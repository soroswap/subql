import { SorobanEvent } from "@subql/types-stellar";
import {
  extractValuesCometEvent,
  updatePairReserves,
} from "./helpers/liquidityEvent";

// This handler works for SWAP, PROVIDE_LIQUIDITY, and WITHDRAW_LIQUIDITY events
export const cometLiquidityHandler = async (event: SorobanEvent) => {
  const eventType = String(event.topic[1]?.value()).toUpperCase();
  // logger.info(JSON.stringify(event));
  
  // try {
  //   const fs = require('fs');
  //   const eventJson = JSON.stringify(event);
    
  //    // Imprimir el directorio actual para diagnóstico
  //    logger.info(`Directorio actual: ${process.cwd()}`);
  //   const filePath = '/app/event1Comet.json';
  //   fs.writeFileSync(filePath, eventJson);
  //   logger.info(`Archivo JSON guardado en: ${filePath}`);
  // } catch (error) {
  //   logger.error(`Error al guardar el archivo JSON: ${error.message}`);
  //   // Mostrar más detalles sobre el error
  //   logger.error(`Detalles del error: ${error.stack}`);
  // }
  
  const contractId = event.contractId.toString();
  logger.info(`[COMET] 🔍 Contract ID: ${contractId}`);
  const cometData = extractValuesCometEvent(event);
  logger.info(`[COMET] 🔍 cometData: ${cometData}`);
  logger.info(`[COMET] 🔍 cometData json: ${JSON.stringify(cometData)}`);

  // Store data into database
  try {
    const currentDate = new Date(event.ledgerClosedAt);
    await updatePairReserves(
      contractId,
      currentDate,
      event.ledger.sequence,
      cometData.tokenA,
      cometData.tokenB,
      BigInt(cometData.reserveA),
      BigInt(cometData.reserveB)
    );

    logger.info(`[COMET] ✨ Updated reserves for pair ${contractId}`);
  } catch (error) {
    logger.error(`[COMET] ❌ Error processing ${eventType} event: ${error}`);
  }
};
