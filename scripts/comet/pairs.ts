import { NETWORK, getCometPools } from "../../src/constants";
import { toolkit } from "../toolkit";
import { scValToNative, xdr } from "@stellar/stellar-sdk";
import * as fs from "fs";
import * as path from "path";

const COMET_POOLS = getCometPools(process.env.NETWORK as NETWORK);

export async function getCometPreStart(): Promise<any> {
  console.log("--------------------------------------------");
  console.log("Updating Comet Data");
  console.log("--------------------------------------------");

  let pools: {
    address: string;
    token_a: string;
    token_b: string;
    reserve_a: any;
    reserve_b: any;
  }[] = [];

  const key = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("AllRecordData")]);
  for (const pool of COMET_POOLS) {
    const rawLedgerEntries = await toolkit.rpc.getContractData(pool, key);

    const ledgerEntries = scValToNative(
      rawLedgerEntries.val.value()["_attributes"].val
    );

    const keys = Object.keys(ledgerEntries);
    if (keys.length < 2) {
      throw new Error("Not enough ledger entries to parse.");
    }

    const entry_1 = ledgerEntries[keys[0]];
    const entry_2 = ledgerEntries[keys[1]];

    pools.push({
      address: pool,
      token_a: keys[0],
      token_b: keys[1],
      reserve_a: entry_1.balance,
      reserve_b: entry_2.balance,
    });
  }

  // Generate file content
  const fileContent = `
  // This file is generated automatically by scripts/comet/pairs.ts
  // Do not modify manually

  export interface CometPairReserves {
    address: string;
    token_a: string;
    token_b: string;
    reserve_a: string;
    reserve_b: string;
  }

  export const cometPairsGeneratedDate = "${new Date().toISOString()}";

  export const cometPairReservesList: CometPairReserves[] = ${JSON.stringify(
    pools,
    (key, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  )};
  `;
  // Write file
  const filePath = path.join(__dirname, "../../src/comet/pairReservesData.ts");
  fs.writeFileSync(filePath, fileContent);
  console.log(`✅ pairReservesData.ts file generated successfully`);
}
