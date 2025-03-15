import { Contract, StrKey } from "@stellar/stellar-sdk";
import { config } from 'dotenv';
import { xdr } from '@stellar/stellar-sdk';
import { encodeContract } from "../../soroswap/helpers/utils";


config();

export function hexToSorobanAddress(hexString: string): string {
    const buffer = Buffer.from(hexString, 'hex');
    return StrKey.encodeContract(buffer);
}
export function getTransactionData(event: any, contractId: string): {
  tokenA: string | undefined;
  tokenB: string | undefined;
  reserveA: bigint | undefined;
  reserveB: bigint | undefined;
} {
      
  const resultMetaXdrString = event.transaction.result_meta_xdr;

  const txMeta = xdr.TransactionMeta.fromXDR(resultMetaXdrString, "base64");
  logger.info(`--------------------------------------------------------`);

  const txOperations = txMeta.v3().operations()[0].changes();
  logger.info(`[COMET] 🟢 Operations Length: ${txOperations.length}`);

  const filteredOperations = txOperations.filter((operation) => {
    const switchName = operation?.["_switch"]?.name;    
    const contractBuffer = operation?.value()?.data()?.["_value"]?._attributes
      ?.contract?._value;
    
    if (switchName === "ledgerEntryUpdated" && contractBuffer) {
      const contractData = JSON.parse(JSON.stringify(contractBuffer)).data;
      const contract = encodeContract(
        Buffer.from(contractData).toString("hex")            
      );
      return contract === contractId;
    }
    return false;
  });
  
  logger.info(`[COMET] 🔍 Operaciones filtradas: ${filteredOperations.length}`);
  let reserveA: bigint | undefined;
  let reserveB: bigint | undefined;
  let tokenA: string | undefined;
  let tokenB: string | undefined;
  let tokens = [];
  let reserves = [];

  // Convertir a JSON para facilitar el procesamiento
  logger.info(`[COMET] 🔍 Convirtiendo operaciones a JSON`);
  const operationsJson = JSON.parse(JSON.stringify(filteredOperations));
  
  // Buscar la operación que contiene AllRecordData
  logger.info(`[COMET] 🔍 Buscando AllRecordData en ${operationsJson.length} operaciones`);
  for (const operation of operationsJson) {
    try {
      logger.info(`[COMET] 🔍 Analizando operación: ${operation._switch?.name || 'desconocida'}`);
      
      if (operation._switch && operation._switch.name === "ledgerEntryUpdated") {
        const data = operation._value?._attributes?.data?._value?._attributes;
        
        if (!data) {
          logger.info(`[COMET] 🔍 No se encontraron datos en la operación`);
          continue;
        }

       
        // find token and reserve
        for (const item of data.val._value) {
          let tokenBuffer = item?._attributes?.key?._value?._value?.data;
          if (tokenBuffer) {  
            tokens.push(hexToSorobanAddress(Buffer.from(tokenBuffer).toString('hex')));
            reserves.push(item._attributes.val._value[0]._attributes.val._value._attributes.lo._value);
          }
        }
        if (tokens.length >= 2) {
          tokenA = tokens[0];
          tokenB = tokens[1];
          reserveA = BigInt(reserves[0]);
          reserveB = BigInt(reserves[1]);
          
          logger.info(`[COMET] ✅ TokenA: ${tokenA}, ReserveA: ${reserveA}`);
          logger.info(`[COMET] ✅ TokenB: ${tokenB}, ReserveB: ${reserveB}`);
        } else {
          logger.info(`[COMET] 🔍 No se encontraron suficientes tokens (se necesitan al menos 2)`);
        }
      }
    } catch (err) {
      logger.error(`[COMET] ❌ Detalles del error: ${err.stack}`);
    }
  }

  logger.info(
    `[COMET] 🟢 Tokens: TokenA=${tokenA || "not found"}, TokenB=${tokenB || "not found"}`
  );
  logger.info(
    `[COMET] 🟢 Reserves: ReserveA=${reserveA?.toString() || "not found"}, ReserveB=${reserveB?.toString() || "not found"}`
  );

  return {
    tokenA,
    tokenB,
    reserveA,
    reserveB
  };
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
        
        logger.debug(`[COMET] 🔍 Generated ledger key for ${contractId}: ${xdrBase64}`);
        
        return xdrBase64;
    } catch (error) {
        logger.error(`[COMET] ❌ Error generating ledger key: ${error}`);
        throw error;
    }
}