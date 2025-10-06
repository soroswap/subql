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

async function getVaultTotalSupply(vaultAddress: string): Promise<string> {
  try {
    const result = await retry(async () => {
      return await invokeCustomContract(
        toolkit,
        vaultAddress,
        "total_supply",
        [],
        true
      );
    });
    const totalSupply = scValToNative(result.result.retval);
    console.log(`🚀 | getVaultTotalSupply | ${vaultAddress} | totalSupply:`, totalSupply);
    return totalSupply.toString();
  } catch (error) {
    console.error(`❌ Error getting total supply for ${vaultAddress}:`, error);
    return "0";
  }
}

export async function fetchDeFindexEntries(): Promise<void> {
  const failedVaults: string[] = [];
  const totalVaults = await getTotalVaults();
  console.log(`📊 Total vaults found: ${totalVaults}`);

  const vaultsInfo: {
    ledger: number;
    address: string;
    totalSupply: string;
    totalManagedFunds: {
      asset: string;
      idle_amount: string;
      invested_amount: string;
      strategy_allocations: {
        amount: string;
        paused: boolean;
        strategy_address: string;
      }[];
      total_amount: string;
    };
  }[] = [];

  try {
    console.log("🚀 Getting vaults information...");
    const latestLedger = (await toolkit.rpc.getLatestLedger()).sequence

    const pLimit = await getPLimit();
    const limit = pLimit(7); // Reduced concurrency for API limit
    const tasks = Array.from({ length: totalVaults }, (_, i) =>
      limit(async () => {
        try {
          console.log(`📊 Processing vault ${i + 1}/${totalVaults}`);

          const vaultAddress = await retry(() => getVault(i));
          const totalManagedFundsResponse = await retry(() => getVaultTotalManagedFunds(vaultAddress));

          // Extract the first element if it's an array, otherwise use as-is
          const totalManagedFunds = Array.isArray(totalManagedFundsResponse) 
            ? totalManagedFundsResponse[0] 
            : totalManagedFundsResponse;

          // Only add vaults with non-zero balances
          if (totalManagedFunds) {
            const hasBalance = totalManagedFunds.total_amount && BigInt(totalManagedFunds.total_amount) > 0;
            
            if (hasBalance) {
              // Get the total supply for this vault
              const totalSupply = await retry(() => getVaultTotalSupply(vaultAddress));
              
              // Convert bigints to strings for JSON serialization
              const serializedFunds = {
                asset: totalManagedFunds.asset,
                idle_amount: totalManagedFunds.idle_amount.toString(),
                invested_amount: totalManagedFunds.invested_amount.toString(),
                strategy_allocations: totalManagedFunds.strategy_allocations.map((alloc: any) => ({
                  amount: alloc.amount.toString(),
                  paused: alloc.paused,
                  strategy_address: alloc.strategy_address,
                })),
                total_amount: totalManagedFunds.total_amount.toString(),
              };

              vaultsInfo.push({
                ledger: latestLedger,
                address: vaultAddress,
                totalSupply: totalSupply,
                totalManagedFunds: serializedFunds,
              });

              console.log(`✅ Information obtained for vault: ${vaultAddress} (Supply: ${totalSupply})`);
            } else {
              console.log(`⏩ Skipping vault with zero balance: ${vaultAddress}`);
            }
          } else {
            console.log(`⏩ Skipping vault with no funds data: ${vaultAddress}`);
          }
        } catch (error) {
          console.error(`❌ Error processing vault ${i}:`, error);
          failedVaults.push(`Vault index ${i}`);
          return;
        }
      })
    );

    await Promise.all(tasks);

    console.log(`\n📊 Valid vaults found: ${vaultsInfo.length}`);
    console.log(JSON.stringify(vaultsInfo, null, 2));

    // Generate file content
    const fileContent = `// This file is generated automatically by scripts/defindex/vaults.ts
// Do not modify manually

export interface VaultReserves {
  ledger: number;
  address: string;
  totalSupply: string;
  totalManagedFunds: {
    asset: string;
    idle_amount: string;
    invested_amount: string;
    strategy_allocations: {
      amount: string;
      paused: boolean;
      strategy_address: string;
    }[];
    total_amount: string;
  };
}

export const defindexVaultsGeneratedDate = "${new Date().toISOString()}";

export const vaultReservesList: VaultReserves[] = ${JSON.stringify(
      vaultsInfo,
      null,
      2
    )};
`;
    // Write file
    const filePath = path.join(
      __dirname,
      "../../src/defindex/vaultReservesData.ts"
    );
    fs.writeFileSync(filePath, fileContent);
    console.log(`✅ vaultReservesData.ts file generated successfully`);
  } catch (error) {
    console.error("❌ General error:", error);
    throw error;
  } finally {
    console.log("\n📊 Execution summary:");
    console.log(`✅ Vaults processed successfully: ${vaultsInfo.length}`);
    if (failedVaults.length > 0) {
      console.log(`❌ Vaults with errors (${failedVaults.length}):`);
      failedVaults.forEach((vault) => console.log(`   - ${vault}`));
    }
  }
}

const replacer = (_key: string, value: any) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};