import { invokeCustomContract } from "soroban-toolkit";
import { NETWORK, getPhoenixFactory } from "../../src/constants";
import { toolkit, sleep, retry } from "../toolkit";
import { scValToNative } from "@stellar/stellar-sdk";
import * as fs from "fs";
import * as path from "path";

const FACTORY_CONTRACT = getPhoenixFactory(process.env.NETWORK as NETWORK);

async function getPools(): Promise<any> {
  try {
    const rawResult = await retry(
      async () => {
        return await invokeCustomContract(
          toolkit,
          FACTORY_CONTRACT,
          "query_all_pools_details",
          [],
          true
        );
      },
      3,
      500,
      2
    );
    const result = scValToNative(rawResult.result.retval);
    return result;
  } catch (error) {
    console.error(`❌ Error getting pools`, error);
    return null;
  }
}

export async function getPhoenixPreStart(): Promise<any> {
  console.log("--------------------------------------------");
  console.log("Updating Phoenix Data");
  console.log("--------------------------------------------");

  try {
    const pools = await getPools();
    if (!pools) {
      console.error("❌ Failed to get Phoenix pools data");
      return;
    }
    
    const parsedPools = parsePoolData(pools);

    // Add a small delay to avoid rate limiting
    await sleep(200);

    const newParsedPools = parsedPools.map((pool) => {
      return {
        address: pool.poolAddress,
        token_a: pool.assetA.address,
        token_b: pool.assetB.address,
        reserve_a: pool.assetA.amount,
        reserve_b: pool.assetB.amount,
        reserve_lp: pool.assetLpShare.amount,
        stake_address: pool.stakeAddress,
        total_fee_bps: pool.totalFeeBps,
      };
    });
    console.log(
      "🚀 « newParsedPools:",
      JSON.stringify(newParsedPools, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    // Generate file content
    const fileContent = `
// This file is generated automatically by scripts/phoenix/pairs.ts
// Do not modify manually

export interface PhoenixPairReserves {
    address: string;
    token_a: string;
    token_b: string;
    reserve_a: string;
    reserve_b: string;
    reserve_lp: string;
    stake_address: string;
    total_fee_bps: string;
}

export const phoenixPairsGeneratedDate = "${new Date().toISOString()}";

export const phoenixPairReservesList: PhoenixPairReserves[] = ${JSON.stringify(
      newParsedPools,
      (key, value) => (typeof value === "bigint" ? value.toString() : value),
      2
    )};
`;
    // Write file
    const filePath = path.join(
      __dirname,
      "../../src/phoenix/pairReservesData.ts"
    );
    fs.writeFileSync(filePath, fileContent);
    console.log(`✅ pairReservesData.ts file generated successfully`);
  } catch (error) {
    console.error("❌ General error when processing Phoenix data:", error);
  }
}

interface PoolData {
  poolAddress: string;
  assetA: {
    address: string;
    amount: string;
  };
  assetB: {
    address: string;
    amount: string;
  };
  assetLpShare: {
    address: string;
    amount: string;
  };
  stakeAddress: string;
  totalFeeBps: string;
}

function parsePoolData(pools: any[]): PoolData[] {
  return pools.map((pool) => ({
    poolAddress: pool.pool_address,
    assetA: {
      address: pool.pool_response.asset_a.address,
      amount: pool.pool_response.asset_a.amount,
    },
    assetB: {
      address: pool.pool_response.asset_b.address,
      amount: pool.pool_response.asset_b.amount,
    },
    assetLpShare: {
      address: pool.pool_response.asset_lp_share.address,
      amount: pool.pool_response.asset_lp_share.amount,
    },
    stakeAddress: pool.pool_response.stake_address,
    totalFeeBps: pool.total_fee_bps,
  }));
}
