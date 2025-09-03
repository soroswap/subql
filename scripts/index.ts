import { config } from "dotenv";
import { generatePairTokenReservesList } from "./soroswap/pairsTokensMaker";
import { getLatestRouterLedger } from "./soroswap/latestLedger";
import { getPhoenixPreStart } from "./phoenix/pairs";
import { getAquaPreStart } from "./aqua/aquaPoolsTokensMaker";
import { fetchDeFindexEntries } from "./defindex/vaults";
config();

export const { SOROBAN_ENDPOINT, SECRET_KEY_HELPER, NETWORK } = process.env;

function validateEnvVariables() {
  if (!SOROBAN_ENDPOINT || !SECRET_KEY_HELPER) {
    console.error(
      "❌ Error: SOROBAN_ENDPOINT and SECRET_KEY_HELPER environment variables are required"
    );
    process.exit(1);
  }
}

async function main() {
  validateEnvVariables();

  // DEFINDEX
  try {
    await fetchDeFindexEntries();
  } catch (error) {
    console.error("❌ Error generating Defindex Entries:", error);
  }

  // SOROSWAP
  try {
    await generatePairTokenReservesList();
    await getLatestRouterLedger();
  } catch (error) {
    console.error("❌ Error generating Soroswap pairs:", error);
  }

  // PHOENIX
  try {
    await getPhoenixPreStart();
  } catch (error) {
    console.error("❌ Error generating Phoenix pairs:", error);
  }

  // AQUA
  try {
    await getAquaPreStart();
  } catch (error) {
    console.error("❌ Error generating Aqua pairs:", error);
  }

  process.exit(1);
}

main();
