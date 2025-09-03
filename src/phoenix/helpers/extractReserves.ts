import { xdr } from "@stellar/stellar-sdk";
import { SorobanEvent } from "@subql/types-stellar";
import { PhoenixPair } from "../../types";
import { hexToSorobanAddress } from "../../utils";

export const extractReservesFromPhoenixEvent = (event: SorobanEvent) => {
  const contractId = event.contractId.toString();
  const resultMetaXdrString = event.transaction.result_meta_xdr;
  const txMeta = xdr.TransactionMeta.fromXDR(resultMetaXdrString, "base64");

  const txOperations = txMeta.v4().operations()[0].changes();

  const filteredOperations = txOperations.filter((operation) => {
    const switchName = operation?.["_switch"]?.name;
    const contractBuffer = operation?.value()?.data()?.["_value"]?._attributes
      ?.contract?._value;

    if (switchName === "ledgerEntryUpdated" && contractBuffer) {
      const contractData = JSON.parse(JSON.stringify(contractBuffer)).data;
      const contract = hexToSorobanAddress(
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
    let key: string;
    if (rawKey?._value === 1) {
      key = "reserveA";
    } else if (rawKey?._value === 2) {
      key = "reserveB";
    } else if (rawKey?._value === 0) {
      key = "reserveLp";
    }

    const rawReserve =
      operation?.["_value"]?._attributes?.data?._value?._attributes?.val;
    const reserve = rawReserve?._value?._attributes?.lo?._value;

    if (key && reserve) {
      acc[key] = reserve;
    }

    return acc;
  }, {});

  return reserves;
};

export const updatePairReserves = async (
  contractId: string,
  currentDate: Date,
  sequence: number,
  reserveA?: bigint,
  reserveB?: bigint,
  reserveLp?: bigint
) => {
  const existingPair = await PhoenixPair.get(contractId);
  if (existingPair && new Date(existingPair.date) > currentDate) {
    logger.info(`[PHOENIX] ⏭️ Existing pair data is more recent, NOT updating`);
    return;
  }

  existingPair.reserveA = reserveA ?? existingPair.reserveA;
  existingPair.reserveB = reserveB ?? existingPair.reserveB;
  existingPair.reserveLp = reserveLp ?? existingPair.reserveLp;
  existingPair.date = currentDate;
  existingPair.ledger = sequence;

  await existingPair.save();
};
