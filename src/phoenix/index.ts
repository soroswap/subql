import { scValToNative, xdr } from "@stellar/stellar-sdk";
import { SorobanEvent } from "@subql/types-stellar";
import { encodeContract } from "../soroswap/helpers/utils";
import { PhoenixPair } from "../types";

export const phoenixSwapHandler = async (event: SorobanEvent) => {
  const contractId = event.contractId.toString();

  const resultMetaXdrString = event.transaction.result_meta_xdr;

  const txMeta = xdr.TransactionMeta.fromXDR(resultMetaXdrString, "base64");

  logger.info(`--------------------------------------------------------`);

  const txOperations = txMeta.v3().operations()[0].changes();

  logger.info(`🟢 Operations Length: ${txOperations.length}`);

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

  // Extract the reserve values
  const reserves = filteredOperations.reduce((acc, operation) => {
    const rawKey =
      operation?.["_value"]?._attributes?.data?._value?._attributes?.key;
    const key = rawKey?._value === 1 ? "reserveA" : "reserveB";
    const rawReserve =
      operation?.["_value"]?._attributes?.data?._value?._attributes?.val;
    const reserve = rawReserve?._value?._attributes?.lo?._value;

    if (key && reserve) {
      acc[key] = reserve;
    }

    return acc;
  }, {});

  logger.info(
    `🟢 Reserves: ${JSON.stringify(reserves, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )}`
  );

  // Store data into database
  try {
    // Crear nuevo par o actualizar si existe
    const existingPair = await PhoenixPair.get(contractId);
    const currentDate = new Date(event.ledgerClosedAt);
    if (existingPair && new Date(existingPair.date) > currentDate) {
      logger.info(`⏭️ Existing pair data is more recent, NOT updating`);
      return;
    }

    existingPair.reserveA = reserves["reserveA"];
    existingPair.reserveB = reserves["reserveB"];
    existingPair.date = currentDate;
    existingPair.ledger = event.ledger.sequence;

    await existingPair.save();
  } catch (error) {
    logger.warn(`❌ Error processing swap event: ${error}`);
  }
};
