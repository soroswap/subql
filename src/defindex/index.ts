import { xdr, scValToNative, nativeToScVal } from "@stellar/stellar-sdk";
import { SorobanEvent } from "@subql/types-stellar";
import { hexToSorobanAddress } from "../utils";

export const defindexEventHandler = async (event: SorobanEvent) => {
  const contractId = event.contractId.toString();
  logger.info(`[DEFINDEX] 🔁 ${contractId}`);

  const resultMetaXdrString = event.transaction.result_meta_xdr;
  const txMeta = xdr.TransactionMeta.fromXDR(resultMetaXdrString, "base64");
  const txEvents = txMeta.v3().sorobanMeta().events();

  const eventData = txEvents.find(
    (event) =>
      (`${event.body().value().topics()[0].value()}` === "DeFindexVault" &&
        `${event.body().value().topics()[1].value()}` === "deposit") ||
      (`${event.body().value().topics()[0].value()}` === "DeFindexVault" &&
        `${event.body().value().topics()[1].value()}` === "withdraw")
  );

  if (eventData) {
    const dataXdr = eventData.body().value().data().toXDR();
    const scValData = xdr.ScVal.fromXDR(dataXdr).value() as xdr.ScVal[];
    
    let amounts: bigint[];
    let from: string;
    let dfTokens: bigint;

    for (const val of scValData) {
      const parsedVal = JSON.parse(JSON.stringify(val))
      const keyBuffer = parsedVal._attributes?.key?._value?.data;
      const keyText = Buffer.from(keyBuffer).toString();
      logger.info(`🚀 | keyText: ${keyText}`);

      switch (keyText) {
        case "amounts":
          const amountsRawValue = parsedVal._attributes?.val?._value
          const amountsArray = []
          for (const amount of amountsRawValue) {
            const value = amount?._value?._attributes?.lo._value
            const bigintValue = BigInt(value)
            amountsArray.push(bigintValue)
          }

          amounts = amountsArray

          break;

        case "depositor":
          const depositorRawValue = parsedVal._attributes?.val?._value
        
          if (depositorRawValue) {
            const buffer = depositorRawValue._value._value.data
            const address = hexToSorobanAddress(buffer)
            from = address
          }
          break;

        case "df_tokens_minted":
          const dfTokensMintedRawValue = parsedVal._attributes?.val?._value
          if (dfTokensMintedRawValue) {
            const rawAmount = dfTokensMintedRawValue._attributes.lo._value
            dfTokens = BigInt(rawAmount)
          }
          break;

        case "total_managed_funds_before":
          const totalManagedFundsBeforeRawValue = parsedVal._attributes?.val?._value
          if (totalManagedFundsBeforeRawValue) {
            logger.info(`🚀 | totalManagedFundsBeforeRawValue: ${JSON.stringify(totalManagedFundsBeforeRawValue)}`);
          }
          break;

        case "total_supply_before":
          const totalSupplyBeforeRawValue = parsedVal._attributes?.val?._value
          if (totalSupplyBeforeRawValue) {
            logger.info(`🚀 | totalSupplyBeforeRawValue: ${JSON.stringify(totalSupplyBeforeRawValue)}`);
          }
          break;
        default:
          logger.info("[DEFINDEX] ⏩🔴🔴 Unrecognized key:", keyText);
      }

      // const key = JSON.parse(`${JSON.stringify(val.value())}`)._attributes.key;
      // logger.info(`🚀 | key: ${JSON.stringify(key)}`);
      
      // logger.info(`🚀 | val: ${val.toXDR("base64")}`);


    }

    logger.info(`🚀 | amounts: ${JSON.stringify(amounts, replacer)}`);
    logger.info(`🚀 | from: ${from}`);
    logger.info(`🚀 | dfTokens: ${dfTokens}`);
    // logger.info(`🚀 | scValData: ${JSON.stringify(scValData)}`);

  } else {
    logger.info("🚀 | No matching event found");
  }
};

const replacer = (key: string, value: any) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};