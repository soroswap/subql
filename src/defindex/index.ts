import { xdr, scValToNative, nativeToScVal } from "@stellar/stellar-sdk";
import { SorobanEvent } from "@subql/types-stellar";
import { hexToSorobanAddress } from "../utils";
import { DeFindexVault } from "../types";
import { DeFindexVaultProps } from "../types/models/DeFindexVault";

export const defindexEventHandler = async (event: SorobanEvent) => {
  const contractId = event.contractId.toString();
  logger.info(`[DEFINDEX] 🔁 ${contractId}`);
  const date = event.ledger.closed_at;
  const ledger = event.ledger.sequence

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

  const eventType = `${eventData?.body().value().topics()[1].value()}`;

  if (eventData) {
    const dataXdr = eventData.body().value().data().toXDR();
    const scValData = xdr.ScVal.fromXDR(dataXdr).value() as xdr.ScVal[];

    let amounts: bigint[];
    let from: string;
    let dfTokens: bigint;
    let totalManagedFundsBefore: {
      asset: string;
      idle_amount: bigint;
      invested_amount: bigint;
      strategy_allocations: {
        amount: bigint;
        paused: boolean;
        strategy_address: string;
      }[];
      total_amount: bigint;
    };
    let totalSupplyBefore: bigint;

    for (const val of scValData) {
      const parsedVal = JSON.parse(JSON.stringify(val));
      const keyBuffer = parsedVal._attributes?.key?._value?.data;
      const keyText = Buffer.from(keyBuffer).toString();
      logger.info(`🚀 | keyText: ${keyText}`);

      switch (keyText) {
        case "amounts_withdrawn":
        case "amounts":
          const amountsRawValue = parsedVal._attributes?.val?._value;
          const amountsArray = [];
          for (const amount of amountsRawValue) {
            const value = amount?._value?._attributes?.lo._value;
            const bigintValue = BigInt(value);
            amountsArray.push(bigintValue);
          }

          amounts = amountsArray;

          break;
        case "depositor":
        case "withdrawer":
          const depositorRawValue = parsedVal._attributes?.val?._value;

          if (depositorRawValue) {
            const buffer = depositorRawValue._value._value.data;
            const address = hexToSorobanAddress(buffer);
            from = address;
          }
          break;
        case "df_tokens_minted":
        case "df_tokens_burned":
          const dfTokensRawValue = parsedVal._attributes?.val?._value;
          if (dfTokensRawValue) {
            const rawAmount = dfTokensRawValue._attributes.lo._value;
            dfTokens = BigInt(rawAmount);
          }
          break;
        case "total_managed_funds_before":
          const totalManagedFundsBeforeRawValue =
            parsedVal._attributes?.val?._value;
          if (totalManagedFundsBeforeRawValue) {
            const managedFunds = totalManagedFundsBeforeRawValue[0]._value;
            const parsedFunds = {
              asset: hexToSorobanAddress(
                managedFunds[0]._attributes.val._value._value.data
              ),
              idle_amount: BigInt(
                managedFunds[1]._attributes.val._value._attributes.lo._value
              ),
              invested_amount: BigInt(
                managedFunds[2]._attributes.val._value._attributes.lo._value
              ),
              strategy_allocations: managedFunds[3]._attributes.val._value.map(
                (strategy: any) => ({
                  amount: BigInt(
                    strategy._value[0]._attributes.val._value._attributes.lo
                      ._value
                  ),
                  paused: strategy._value[1]._attributes.val._value,
                  strategy_address: hexToSorobanAddress(
                    strategy._value[2]._attributes.val._value._value.data
                  ),
                })
              ),
              total_amount: BigInt(
                managedFunds[4]._attributes.val._value._attributes.lo._value
              ),
            };
            totalManagedFundsBefore = parsedFunds;
          }
          break;
        case "total_supply_before":
          const totalSupplyBeforeRawValue = parsedVal._attributes?.val?._value;
          if (totalSupplyBeforeRawValue) {
            const supply = BigInt(
              totalSupplyBeforeRawValue._attributes.lo._value
            );
            totalSupplyBefore = supply;
          }
          break;
        default:
          logger.info("[DEFINDEX] ⏩🔴🔴 Unrecognized key:", keyText);
      }
    }

    logger.info(`🚀 | contractId: ${contractId}`);
    logger.info(`🚀 | amounts: ${JSON.stringify(amounts, replacer)}`);
    logger.info(`🚀 | from: ${from}`);
    logger.info(`🚀 | dfTokens: ${dfTokens}`);
    logger.info(`🚀 | totalManagedFundsBefore: ${JSON.stringify(totalManagedFundsBefore, replacer)}`);
    logger.info(`🚀 | totalSupplyBefore: ${totalSupplyBefore}`);
    logger.info(`🚀 | eventType: ${eventType}`);
    logger.info(`🚀 | date: ${new Date(date)}`);
    logger.info(`🚀 | ledger: ${ledger}`);


    const entryData: DeFindexVaultProps = {
      id: contractId,
      date: new Date(date),
      ledger: ledger,
      vault: contractId,
      eventType: eventType,
      from: from,
      amounts: amounts,
      dfTokens: dfTokens,
      totalSupplyBefore: totalSupplyBefore,
      totalManagedFundsBefore: JSON.stringify(totalManagedFundsBefore, replacer),
      previousPricePerShare: BigInt(0),
      newPricePerShare: BigInt(0),
    }

    const createdEntry = DeFindexVault.create(entryData)
  
    await createdEntry.save();

  } else {
    logger.info("🚀 | No matching event found");
  }
};

const replacer = (key: string, value: any) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};
