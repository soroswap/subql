import { vaultReservesList, defindexVaultsGeneratedDate } from "./vaultReservesData";
import { DeFindexVault } from "../types";
import { createHash } from 'crypto';

// Function to generate a unique hash for an initialization event
const generateInitEventId = (contractId: string, ledger: number, date: string): string => {
  const data = `init-${contractId}-${ledger}-${date}`;
  return createHash('sha256').update(data).digest('hex');
};

export const initializeDeFindexDB = async (contractId: string) => {
  const failedVaults: string[] = [];

  try {
    logger.info("🔍 Checking if DeFindex vaults need initialization");
    
    // Check if any DeFindex data exists for this specific vault
    const existingVaultData = await DeFindexVault.getByFields([
      ['vault', '=', contractId]
    ], { limit: 1 });
    
    if (existingVaultData && existingVaultData.length > 0) {
      logger.info("✅ DeFindex vault already initialized for:", contractId);
      return;
    }

    logger.info(`🚀 Initializing DeFindex vaults from pre-fetched data`);
    logger.info(`📊 Total vaults to initialize: ${vaultReservesList.length}`);

    // Iterate over the list of vaults from the vaultReservesData.ts file
    for (const [index, vault] of vaultReservesList.entries()) {
      try {
        // Check if a record already exists for this vault
        const existingEntries = await DeFindexVault.getByFields([
          ['vault', '=', vault.address]
        ], { limit: 1 });

        if (!existingEntries || existingEntries.length === 0) {
          logger.info(
            `📊 Processing vault ${index + 1}/${vaultReservesList.length}: ${
              vault.address
            }`
          );

          // Use a base ledger number for initialization (this will be updated with real events)
          const initDate = new Date(defindexVaultsGeneratedDate);

          // Create the initial record with the pre-fetched information
          const initialEntry = DeFindexVault.create({
            id: generateInitEventId(vault.address, vault.ledger, initDate.toISOString()),
            date: initDate,
            ledger: vault.ledger,
            vault: vault.address,
            eventType: 'init',
            from: 'GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO', // Default initialization address
            amounts: [], // Empty for initialization
            dfTokens: BigInt(0), // No tokens for initialization
            totalSupplyBefore: BigInt(vault.totalSupply || "0"), // Use the fetched total supply
            totalManagedFundsBefore: JSON.stringify(vault.totalManagedFunds),
            previousPricePerShare: BigInt(0),
            newPricePerShare: BigInt(0),
            apy: 0,
          });

          await initialEntry.save();
          logger.info(`✨ Vault initialized: ${vault.address}`);

          // Small pause between each vault to avoid potential database locks
          await new Promise((resolve) => setTimeout(resolve, 50));
        } else {
          logger.info(`⏩ Vault already exists: ${vault.address}`);
        }
      } catch (error) {
        logger.error(`❌ Error initializing vault ${vault.address}: ${error}`);
        failedVaults.push(vault.address);
      }
    }

    // Final summary
    logger.info("📊 DeFindex initialization summary:");
    logger.info(
      `✅ Successfully processed vaults: ${
        vaultReservesList.length - failedVaults.length
      }`
    );
    if (failedVaults.length > 0) {
      logger.info(`❌ Vaults with errors (${failedVaults.length}):`);
      failedVaults.forEach((vault) => logger.info(`   - ${vault}`));
    }
  } catch (error) {
    logger.error("❌ General error in DeFindex initialization:", error);
    throw error;
  }

  logger.info("✅ DeFindex initialization completed");
};