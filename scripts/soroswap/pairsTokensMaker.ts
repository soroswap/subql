import { invokeCustomContract } from "soroban-toolkit";
import { Keypair, scValToNative, xdr } from "@stellar/stellar-sdk";
import * as fs from "fs";
import * as path from "path";
import { NETWORK, getSoroswapFactory } from "../../src/constants";
import { retry, toolkit, sleep } from "../toolkit";

import { LimitFunction } from "p-limit";

export async function getPLimit(): Promise<(concurrency: number) => LimitFunction> {
  const module = (await eval("import('p-limit')")) as {
    default: (concurrency: number) => LimitFunction;
  };
  return module.default;
}

const FACTORY_CONTRACT = getSoroswapFactory(process.env.NETWORK as NETWORK).address;

async function getAllPairsLength(): Promise<number> {
  const retryWithBackoff = async (retries = 3, delay = 1000): Promise<number> => {
    try {
      const result = await invokeCustomContract(
        toolkit,
        FACTORY_CONTRACT,
        "all_pairs_length",
        [],
        true
      );
      return Number(scValToNative(result.result.retval));
    } catch (error: any) {
      if (error?.response?.status === 429 && retries > 0) {
        console.log(`⚠️ Rate limit reached in getAllPairsLength. Retrying in ${delay}ms... (${retries} attempts remaining)`);
        await sleep(delay);
        return retryWithBackoff(retries - 1, delay * 2);
      }
      throw error;
    }
  };

  try {
    return await retryWithBackoff();
  } catch (error) {
    console.error("❌ Error getting total number of pairs:", error);
    throw error;
  }
}

async function getPairAddress(index: number): Promise<string> {
  const retryWithBackoff = async (retries = 3, delay = 1000): Promise<string> => {
    try {
      const result = await invokeCustomContract(
        toolkit,
        FACTORY_CONTRACT,
        "all_pairs",
        [xdr.ScVal.scvU32(index)],
        true
      );
      return scValToNative(result.result.retval);
    } catch (error: any) {
      if (error?.response?.status === 429 && retries > 0) {
        console.log(`⚠️ Rate limit reached in getPairAddress. Retrying in ${delay}ms... (${retries} attempts remaining)`);
        await sleep(delay);
        return retryWithBackoff(retries - 1, delay * 2);
      }
      throw error;
    }
  };

  try {
    return await retryWithBackoff();
  } catch (error) {
    console.error(`❌ Error getting pair address ${index}:`, error);
    throw error;
  }
}

async function getToken(pairAddress: string, method: "token_0" | "token_1"): Promise<string> {
  const retryWithBackoff = async (retries = 3, delay = 1000): Promise<string> => {
    try {
      const result = await invokeCustomContract(toolkit, pairAddress, method, [], true);
      return scValToNative(result.result.retval);
    } catch (error: any) {
      if (error?.response?.status === 429 && retries > 0) {
        console.log(`⚠️ Rate limit reached in getToken. Retrying in ${delay}ms... (${retries} attempts remaining)`);
        await sleep(delay);
        return retryWithBackoff(retries - 1, delay * 2);
      }
      throw error;
    }
  };

  try {
    return await retryWithBackoff();
  } catch (error) {
    console.error(`❌ Error getting token (${method}) for pair ${pairAddress}:`, error);
    throw error;
  }
}

async function getPairReserves(pairAddress: string): Promise<[bigint, bigint]> {
  const retryWithBackoff = async (retries = 3, delay = 1000): Promise<[bigint, bigint]> => {
    try {
      const result = await invokeCustomContract(toolkit, pairAddress, "get_reserves", [], true);
      const [reserve0, reserve1] = scValToNative(result.result.retval);
      return [BigInt(reserve0), BigInt(reserve1)];
    } catch (error: any) {
      if (error?.response?.status === 429 && retries > 0) {
        console.log(`⚠️ Rate limit reached in getPairReserves. Retrying in ${delay}ms... (${retries} attempts remaining)`);
        await sleep(delay);
        return retryWithBackoff(retries - 1, delay * 2);
      }
      return [BigInt(0), BigInt(0)];
    }
  };

  try {
    return await retryWithBackoff();
  } catch (error) {
    console.error(`❌ Error getting reserves for ${pairAddress}:`, error);
    return [BigInt(0), BigInt(0)];
  }
}

export async function generatePairTokenReservesList(): Promise<void> {
  const pairTokenReserves: {
    address: string;
    token_a: string;
    token_b: string;
    reserve_a: string;
    reserve_b: string;
  }[] = [];
  const failedPairs: string[] = [];
  const totalPairs = await getAllPairsLength();
  console.log(`📊 Total pairs found: ${totalPairs}`);
  try {
    console.log("🚀 Getting pairs information...");

    const pLimit = await getPLimit();
    const limit = pLimit(10); // Reduced from 20 to 10 to avoid API overload
    const tasks = Array.from({ length: totalPairs }, (_, i) =>
      limit(async () => {
        try {
          console.log(`📊 Processing pair ${i + 1}/${totalPairs}`);

          const pairAddress = await retry(() => getPairAddress(i));
          const token_a = await retry(() => getToken(pairAddress, "token_0"));
          const token_b = await retry(() => getToken(pairAddress, "token_1"));
          const [reserve_a, reserve_b] = await retry(() => getPairReserves(pairAddress));

          pairTokenReserves.push({
            address: pairAddress,
            token_a,
            token_b,
            reserve_a: reserve_a.toString(),
            reserve_b: reserve_b.toString(),
          });

          console.log(`✅ Information obtained for pair: ${pairAddress}`);
          // Add delay between pair processing
          await sleep(200);
        } catch (error) {
          console.error(`❌ Error processing pair ${i}:`, error);
          failedPairs.push(`Pair index ${i}`);
          return;
        }
      })
    );

    await Promise.all(tasks);

    // Generate file content
    const fileContent = `
// This file is generated automatically by scripts/soroswap/pairsTokensMaker.ts
// Do not modify manually

export interface PairTokenReserves {
    address: string;
    token_a: string;
    token_b: string;
    reserve_a: string;
    reserve_b: string;
}

export const soroswapPairsGeneratedDate = "${new Date().toISOString()}";

export const pairTokenReservesList: PairTokenReserves[] = ${JSON.stringify(
      pairTokenReserves,
      null,
      2
    )};
`;
    // Write file
    const filePath = path.join(__dirname, "../../src/soroswap/pairReservesData.ts");
    fs.writeFileSync(filePath, fileContent);
    console.log(`✅ pairReservesData.ts file generated successfully`);
  } catch (error) {
    console.error("❌ General error:", error);
    throw error;
  } finally {
    console.log("\n📊 Execution summary:");
    console.log(`✅ Pairs processed successfully: ${pairTokenReserves.length}`);
    if (failedPairs.length > 0) {
      console.log(`❌ Pairs with errors (${failedPairs.length}):`);
      failedPairs.forEach((pair) => console.log(`   - ${pair}`));
    }
  }
}
