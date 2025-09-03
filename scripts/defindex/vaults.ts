import { invokeCustomContract } from "soroban-toolkit";
import { Keypair, scValToNative, xdr } from "@stellar/stellar-sdk";
import * as fs from "fs";
import * as path from "path";
import { NETWORK, getDefindexFactory } from "../../src/constants";
import { retry, toolkit } from "../toolkit";

import { LimitFunction } from "p-limit";

export async function getPLimit(): Promise<
  (concurrency: number) => LimitFunction
> {
  const module = (await eval("import('p-limit')")) as {
    default: (concurrency: number) => LimitFunction;
  };
  return module.default;
}

const FACTORY_CONTRACT = getDefindexFactory(process.env.NETWORK as NETWORK);

async function getTotalVaults(): Promise<number> {
  try {
    const result = await retry(async () => {
      return await invokeCustomContract(
        toolkit,
        FACTORY_CONTRACT,
        "total_vaults",
        [],
        true
      );
    });
    return Number(scValToNative(result.result.retval));
  } catch (error) {
    console.error("❌ Error getting total number of pairs:", error);
    throw error;
  }
}

async function getVault(index: number): Promise<string> {
  try {
    const result = await retry(async () => {
      return await invokeCustomContract(
        toolkit,
        FACTORY_CONTRACT,
        "get_vault_by_index",
        [xdr.ScVal.scvU32(index)],
        true
      );
    });
    return scValToNative(result.result.retval);
  } catch (error) {
    console.error(`❌ Error getting pair address ${index}:`, error);
    throw error;
  }
}

async function getVaultTotalManagedFunds(vaultAddress: string): Promise<any> {
  try {
    const result = await retry(async () => {
      return await invokeCustomContract(
        toolkit,
        vaultAddress,
        "fetch_total_managed_funds",
        [],
        true
      );
    });
    const parsedResult = scValToNative(result.result.retval);
    console.log("🚀 | getVaultTotalManagedFunds | parsedResult:", JSON.stringify(parsedResult, replacer, 2))
    return parsedResult
  } catch (error) {
    console.error(`❌ Error getting reserves for ${vaultAddress}:`, error);
    return [BigInt(0), BigInt(0)];
  }
}

export async function fetchDeFindexEntries(): Promise<void> {
  let amounts: bigint[] = [];
  let from: string = "";
  let dfTokens: bigint = BigInt(0);
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
  let totalSupplyBefore: bigint = BigInt(0);

  const failedPairs: string[] = [];
  const totalVaults = await getTotalVaults();
  console.log(`📊 Total pairs found: ${totalVaults}`);

  const vaultsInfo: {
    asset: string
    idle_amount: bigint
    invested_amount: bigint
    strategy_allocations: 
      {
        amount: bigint,
        paused: boolean,
        strategy_address: string
      }[]
    total_amount: bigint
  }[] = [];

  try {
    console.log("🚀 Getting pairs information...");

    const pLimit = await getPLimit();
    const limit = pLimit(10); // Reduced concurrency for API limit
    const tasks = Array.from({ length: totalVaults }, (_, i) =>
      limit(async () => {
        try {
          console.log(`📊 Processing pair ${i + 1}/${totalVaults}`);

          const vaultAddress = await retry(() => getVault(i));
          const totalManagedFunds = await retry(() => getVaultTotalManagedFunds(vaultAddress));

          vaultsInfo.push(totalManagedFunds);

          console.log(`✅ Information obtained for pair: ${vaultAddress}`);
        } catch (error) {
          console.error(`❌ Error processing pair ${i}:`, error);
          failedPairs.push(`Pair index ${i}`);
          return;
        }
      })
    );

    await Promise.all(tasks);

    console.log(vaultsInfo)

    // Generate file content
//     const fileContent = `
// // This file is generated automatically by scripts/soroswap/pairsTokensMaker.ts
// // Do not modify manually

// export interface PairTokenReserves {
//     address: string;
//     token_a: string;
//     token_b: string;
//     reserve_a: string;
//     reserve_b: string;
// }

// export const soroswapPairsGeneratedDate = "${new Date().toISOString()}";

// export const pairTokenReservesList: PairTokenReserves[] = ${JSON.stringify(
//       vaultsInfo,
//       null,
//       2
//     )};
// `;
//     // Write file
//     const filePath = path.join(
//       __dirname,
//       "../../src/soroswap/pairReservesData.ts"
//     );
//     fs.writeFileSync(filePath, fileContent);
    console.log(`✅ pairReservesData.ts file generated successfully`);
  } catch (error) {
    console.error("❌ General error:", error);
    throw error;
  } finally {
    console.log("\n📊 Execution summary:");
    console.log(`✅ Pairs processed successfully: ${vaultsInfo.length}`);
    if (failedPairs.length > 0) {
      console.log(`❌ Pairs with errors (${failedPairs.length}):`);
      failedPairs.forEach((pair) => console.log(`   - ${pair}`));
    }
  }
}

const replacer = (key: string, value: any) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};