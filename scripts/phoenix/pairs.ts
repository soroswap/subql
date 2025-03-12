import { invokeCustomContract } from "soroban-toolkit";
import { NETWORK, getPhoenixFactory } from "../../src/constants";
import { toolkit } from "../toolkit";
import { scValToNative } from "@stellar/stellar-sdk";

const FACTORY_CONTRACT = getPhoenixFactory(process.env.NETWORK as NETWORK);

async function getPools(): Promise<any> {
  try {
    const rawResult = await invokeCustomContract(
      toolkit,
      FACTORY_CONTRACT,
      "query_all_pools_details",
      [],
      true
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

  const pools = await getPools();
  console.log(
    "🚀 « pools:",
    JSON.stringify(pools, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}
