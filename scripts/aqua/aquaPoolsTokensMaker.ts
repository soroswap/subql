import { invokeCustomContract } from "soroban-toolkit";
import { Keypair, scValToNative, xdr, nativeToScVal, ScInt, rpc } from "@stellar/stellar-sdk";
import * as fs from "fs";
import * as path from "path";
import { toolkit, retry } from "../toolkit";
import { NETWORK } from "../../src/constants";
import { getAquaFactory } from "../../src/constants/aquaContracts";
import { getPLimit } from "../soroswap/pairsTokensMaker";

const FACTORY_CONTRACT_AQUA = getAquaFactory(process.env.NETWORK as NETWORK);
console.log("FACTORY_CONTRACT_AQUA", FACTORY_CONTRACT_AQUA);

// Interfaces
interface AquaPool {
  tokenA: string;
  tokenB: string;
  tokenC?: string;
  address: string;
  idx?: string;
  reserveA?: string;
  reserveB?: string;
  reserveC?: string;
  poolType?: string;
  fee?: string;
  futureA?: string;
  futureATime?: string;
  initialA?: string;
  initialATime?: string;
  precisionMulA?: string;
  precisionMulB?: string;
  precisionMulC?: string;
}

async function getTokenSetsCount(): Promise<number> {
  try {
    
    const result = await retry(async () => {
      return await invokeCustomContract(
        toolkit,
        FACTORY_CONTRACT_AQUA,
        "get_tokens_sets_count",
        [],
        true
      );
    });
    return Number(scValToNative(result.result.retval));
  } catch (error) {
    console.error("❌ Error getting the total number of token sets:", error);
    console.log(`⚠️ Checking contract existence...`);
    try {
      // Try to get basic contract information to verify its existence
      const contractData = await toolkit.rpc.getLatestLedger();
      console.log(`📊 Latest ledger: ${contractData.sequence}`);
    } catch (innerError) {
      console.error(`❌ Error verifying the network: ${innerError}`);
    }
    throw error;
  }
}

async function getTokens(index: number): Promise<string[]> {
  try {
    const indexScVal = new ScInt(BigInt(index)).toU128();
    const result = await retry(async () => {
      return await invokeCustomContract(
        toolkit,
        FACTORY_CONTRACT_AQUA,
        "get_tokens",
        [indexScVal],
        true,
        Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
      );
    });
    return scValToNative(result.result.retval) as string[];
  } catch (error) {
    console.error(`❌ Error getting tokens for index ${index}:`, error);
    throw error;
  }
}

async function getPools(tokens: string[]): Promise<{ [key: string]: { idx: string, address: string } }> {
  try {
    const tokenScVals = tokens.map((token) => nativeToScVal(token, { type: "address" }));

    const result = await retry(async () => {
      return await invokeCustomContract(
        toolkit,
        FACTORY_CONTRACT_AQUA,
        "get_pools",
        [xdr.ScVal.scvVec(tokenScVals)],
        true,
        Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
      );
    });
    
    const scValMap = result.result.retval;
    
    if (scValMap.switch() !== xdr.ScValType.scvMap()) {
      throw new Error("The result is not a map");
    }
    
    const map = scValMap.map();
    const processedResult: { [key: string]: { idx: string, address: string } } = {};
    
    if (map) {
      for (let i = 0; i < map.length; i++) {
        const entry = map[i];
        const keyScVal = entry.key();
        const valueScVal = entry.val();
        
        let idxBase64 = "";
        if (keyScVal.switch() === xdr.ScValType.scvBytes()) {
          const bytes = keyScVal.bytes();
          idxBase64 = Buffer.from(bytes).toString('base64');
          console.log(`BytesN<32> original to Base64: ${idxBase64}`);
        }
        
        const address = scValToNative(valueScVal);
        
        processedResult[idxBase64] = {
          idx: idxBase64,
          address: address as string
        };
      }
    }
    
    return processedResult;
  } catch (error) {
    console.error("❌ Error getting pools for tokens:", tokens, error);
    throw error;
  }
}

async function getPoolType(contract: string): Promise<string> {
  try {
    const result = await retry(async () => {
      return await invokeCustomContract(
        toolkit,
        contract,
        "pool_type",
        [],
        true,
        Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
      );
    });
    return scValToNative(result.result.retval) as string;
  } catch (error) {
    console.error(`❌ Error getting pool type for ${contract}:`, error);
    return "";
  }
}

async function getPoolFee(contract: string): Promise<string> {
  try {
    const result = await retry(async () => {
      return await invokeCustomContract(
        toolkit,
        contract,
        "get_fee_fraction",
        [],
        true,
        Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
      );
    });
    return scValToNative(result.result.retval) as string;
  } catch (error) {
    console.error(`❌ Error getting fee for ${contract}:`, error);
    return "";
  }
}

async function getPoolReserves(
  poolAddress: string,
  poolType?: string
): Promise<{ reserveA?: string; reserveB?: string; reserveC?: string }> {
  try {
    const server = new rpc.Server(process.env.SOROBAN_ENDPOINT as string, {
      allowHttp: true,
    });

    const instanceKey = xdr.ScVal.scvLedgerKeyContractInstance();

    const response = await server.getContractData(poolAddress, instanceKey);

    if (response) {
      const storage = response.val.contractData().val().instance().storage();

      const contractValues: { [key: string]: any } = {};

      storage?.forEach((entry) => {
        const key = scValToNative(entry.key());
        const value = scValToNative(entry.val());
        contractValues[key] = value;
      });

      if (poolType === "stable") {
        const reserves =
          contractValues["Reserves"] || contractValues["reserves"] || contractValues["RESERVES"];

        if (Array.isArray(reserves) && reserves.length >= 2) {
          console.log(`ℹ️ stable pool found with reserves: [${reserves.join(", ")}]`);
          const result: { reserveA?: string; reserveB?: string; reserveC?: string } = {
            reserveA: reserves[0]?.toString(),
            reserveB: reserves[1]?.toString(),
          };
          
          if (reserves.length >= 3 && reserves[2] !== undefined) {
            result.reserveC = reserves[2].toString();
            console.log(`ℹ️ pool with three reserves: ${result.reserveC} found`);
          }
          
          return result;
        } else {
          console.log(`⚠️ Pool stable sin array de reservas válido: ${poolAddress}`);
        }
      } else {
        const reserveA =
          contractValues["ReserveA"]?.toString() ||
          contractValues["reserve_a"]?.toString() ||
          contractValues["reserveA"]?.toString() ||
          contractValues["reserve0"]?.toString() ||
          contractValues["Reserve0"]?.toString();

        const reserveB =
          contractValues["ReserveB"]?.toString() ||
          contractValues["reserve_b"]?.toString() ||
          contractValues["reserveB"]?.toString() ||
          contractValues["reserve1"]?.toString() ||
          contractValues["Reserve1"]?.toString();
          
        const reserveC =
          contractValues["ReserveC"]?.toString() ||
          contractValues["reserve_c"]?.toString() ||
          contractValues["reserveC"]?.toString() ||
          contractValues["reserve2"]?.toString() ||
          contractValues["Reserve2"]?.toString();

        return {
          reserveA,
          reserveB,
          reserveC,
        };
      }
    }

    return {};
  } catch (error) {
    console.error(`❌ Error getting reserves for pool ${poolAddress}:`, error);
    return {};
  }
}

async function getStablePoolData(
  poolAddress: string
): Promise<{
  futureA?: string;
  futureATime?: string;
  initialA?: string;
  initialATime?: string;
  precisionMulA?: string;
  precisionMulB?: string;
  precisionMulC?: string;
}> {
  let precisionMulA: string | undefined;
  let precisionMulB: string | undefined;
  let precisionMulC: string | undefined;
  let futureA: string | undefined;
  let futureATime: string | undefined;
  let initialA: string | undefined;
  let initialATime: string | undefined;
  try {
    const server = new rpc.Server(process.env.SOROBAN_ENDPOINT as string, {
      allowHttp: true,
    });

    // For data type instance, we use scvLedgerKeyContractInstance
    const instanceKey = xdr.ScVal.scvLedgerKeyContractInstance();

    // Get all data from the instance
    const response = await server.getContractData(poolAddress, instanceKey);

    if (response) {
      // Decode data from the instance
      const storage = response.val.contractData().val().instance().storage();

      // Create an object to store all values
      const contractValues: { [key: string]: any } = {};

      // Iterate through storage to get all values
      storage?.forEach((entry) => {
        const key = scValToNative(entry.key());
        const value = scValToNative(entry.val());
        contractValues[key] = value;
      });
      const precisionMul =
        contractValues["PrecisionMul"];

        if (Array.isArray(precisionMul) && precisionMul.length >= 2) {
          console.log(`PrecisionMul: [${precisionMul[0]}, ${precisionMul[1]}]`);
          precisionMulA = precisionMul[0]?.toString();
          precisionMulB = precisionMul[1]?.toString();
          if (Array.isArray(precisionMul) && precisionMul.length === 3) { 
            precisionMulC = precisionMul[2]?.toString();
          } else {
            precisionMulC = undefined;
          }
          
        } else {
          console.log(`⚠️ Stable pool without precisionMul: ${poolAddress}`);
        }
        futureA = contractValues["FutureA"]?.toString();
        futureATime = contractValues["FutureATime"]?.toString();
        initialA = contractValues["InitialA"]?.toString();
        initialATime = contractValues["InitialATime"]?.toString();
      return {
        futureA,
        futureATime,
        initialA,
        initialATime,
        precisionMulA,
        precisionMulB,
        precisionMulC,
      };
      };
      } catch (error) {
        console.error(`❌ Error getting stable pool data for ${poolAddress}:`, error); 
      }
      return {
        futureA: undefined,
        futureATime: undefined,
        initialA: undefined,
        initialATime: undefined,
        precisionMulA: undefined,
        precisionMulB: undefined,
        precisionMulC: undefined,
      };
    }

// Simplified main function
export async function getAquaPreStart(): Promise<void> {
  const aquaPools: AquaPool[] = [];
  const failedIndices: number[] = [];
  const poolAddressSet = new Set<string>(); 

  try {
    // Verify endpoint
    try {
      const latestLedger = await toolkit.rpc.getLatestLedger();
      console.log(`✅ Connection to endpoint successful. Latest ledger: ${latestLedger.sequence}`);
    } catch (error) {
      console.error(`❌ Error connecting to endpoint: ${error}`);
      throw new Error("Error connecting to Soroban endpoint");
    }
    
    // Get total of sets
    const totalSets = await getTokenSetsCount();
    console.log(`📊 Total of sets of tokens: ${totalSets}`);

    const pLimit = await getPLimit();
    const limit = pLimit(10); // Adjust concurrency level
    const tasks = Array.from({ length: totalSets }, (_, i) =>
      limit(async () => {
        try {
          console.log(
            `🔍 Processing index ${i}/${totalSets - 1} (${(((i + 1) / totalSets) * 100).toFixed(
              1
            )}%)`
          );

          const tokens = await getTokens(i);
          if (!tokens || tokens.length < 2) {
            console.warn(`⚠️ Invalid tokens for index ${i}`);
            return;
          }

          const pools = await getPools(tokens);
          if (!pools || Object.keys(pools).length === 0) {
            console.warn(`⚠️ No pools found for index ${i}`);
            return;
          }

          console.log(
            `📊 Found ${Object.keys(pools).length} pools for tokens [${tokens[0]}, ${
              tokens[1]
            }]`
          );

          for (const key in pools) {
            const poolInfo = pools[key];
            const poolAddress = poolInfo.address;
            const poolIdx = poolInfo.idx;

            if (poolAddressSet.has(poolAddress)) {
              console.log(`⏭️ Pool ${poolAddress} already processed, skipping...`);
              continue;
            }

            poolAddressSet.add(poolAddress);

            const poolData: AquaPool = {
              tokenA: tokens[0],
              tokenB: tokens[1],
              address: poolAddress,
              idx: poolIdx
            };
            
            if (tokens.length >= 3) {
              poolData.tokenC = tokens[2];
              console.log(`ℹ️ pool with third token: ${tokens[2]}`);
            }

            const poolType = await getPoolType(poolAddress);
            if (poolType) {
              poolData.poolType = poolType;
              console.log(`ℹ️ Pool type for ${poolAddress}: ${poolType}`);
            }

            const fee = await getPoolFee(poolAddress);
            if (fee) {
              poolData.fee = fee.toString();
              console.log(`💰 Fee for pool ${poolAddress}: ${fee}`);
            }

            const reserves = await getPoolReserves(poolAddress, poolType);
            if (reserves.reserveA) poolData.reserveA = reserves.reserveA;
            if (reserves.reserveB) poolData.reserveB = reserves.reserveB;
            if (reserves.reserveC) poolData.reserveC = reserves.reserveC;

            if (poolType === "stable") {
              const stablePoolData = await getStablePoolData(poolAddress);
              poolData.futureA = stablePoolData.futureA;
              poolData.futureATime = stablePoolData.futureATime;
              poolData.initialA = stablePoolData.initialA;
              poolData.initialATime = stablePoolData.initialATime;
              poolData.precisionMulA = stablePoolData.precisionMulA;
              poolData.precisionMulB = stablePoolData.precisionMulB;
              poolData.precisionMulC = stablePoolData.precisionMulC;
              
              console.log(`🔄 Stable pool data obtained for ${poolAddress}`);
            }

            aquaPools.push(poolData);
            console.log(`✅ Pool added: ${poolAddress} (${tokens[0]} - ${tokens[1]})`);
          }
        } catch (error) {
          console.error(`❌ Error in index ${i}:`, error);
          failedIndices.push(i);
        }
      })
    );

    await Promise.all(tasks);

    // Generar contenido del archivo
    const fileContent = `
// This file was generated automatically by aquaPoolsTokensMaker.ts
// Do not modify manually

// Total of pools: ${aquaPools.length}

export interface AquaPool {
    tokenA: string;
    tokenB: string;
    tokenC?: string;
    address: string;
    idx?: string;
    reserveA?: string;
    reserveB?: string;
    reserveC?: string;
    poolType?: string;
    fee?: string;
    futureA?: string;
    futureATime?: string;
    initialA?: string;
    initialATime?: string;
    precisionMulA?: string;
    precisionMulB?: string;
    precisionMulC?: string;
}
export const aquaPoolsGeneratedDate = "${new Date().toISOString()}";
export const aquaPoolsList: AquaPool[] = ${JSON.stringify(aquaPools, null, 2)};
`;

    // Asegurar que el directorio existe
    const outputDir = path.join(__dirname, "../../src/aqua");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write file
    const filePath = path.join(outputDir, "aquaPools.ts");
    fs.writeFileSync(filePath, fileContent);
    console.log(`\n✅ aquaPools.ts generated successfully in ${filePath}`);

    // Final statistics
    console.log("\n📊 Execution summary:");
    console.log(`✅ Total of pools saved: ${aquaPools.length}`);

    if (failedIndices.length > 0) {
      console.log(`❌ Indices with errors: ${failedIndices.length}`);
      // Save errors to file
      const errorPath = path.join(__dirname, "../aquapools-errors.json");
      fs.writeFileSync(errorPath, JSON.stringify(failedIndices, null, 2));
      console.log(`📝 Errors list saved in ${errorPath}`);
    }

    // Additional statistics
    const poolsWithReserves = aquaPools.filter((pool) => pool.reserveA && pool.reserveB).length;
    const poolsWithoutReserves = aquaPools.length - poolsWithReserves;
    const poolsWithType = aquaPools.filter((pool) => pool.poolType).length;
    const poolsWithFee = aquaPools.filter((pool) => pool.fee).length;
    const poolsWithIdx = aquaPools.filter((pool) => pool.idx).length;
    const poolsWithZeroReserves = aquaPools.filter(
      (pool) => pool.reserveA === "0" && pool.reserveB === "0"
    ).length;
    const stablePools = aquaPools.filter((pool) => pool.poolType === "stable").length;
    const stablePoolsWithData = aquaPools.filter((pool) => pool.poolType === "stable" && pool.futureA).length;
    const poolsWithThreeTokens = aquaPools.filter((pool) => pool.tokenC).length;
    const poolsWithThreeReserves = aquaPools.filter((pool) => pool.reserveC).length;

    console.log(`\n📊 Pool statistics`);
    console.log(
      `✅ Pools with reserves: ${poolsWithReserves} (${(
        (poolsWithReserves / aquaPools.length) *
        100
      ).toFixed(2)}%)`
    );
    console.log(
      `⚠️ Pools without reserves: ${poolsWithoutReserves} (${(
        (poolsWithoutReserves / aquaPools.length) *
        100
      ).toFixed(2)}%)`
    );
    console.log(
      `ℹ️ Pools with type: ${poolsWithType} (${((poolsWithType / aquaPools.length) * 100).toFixed(
        2
      )}%)`
    );
    console.log(
      `💰 Pools with fee: ${poolsWithFee} (${((poolsWithFee / aquaPools.length) * 100).toFixed(2)}%)`
    );
    console.log(
      `🔑 Pools with idx: ${poolsWithIdx} (${((poolsWithIdx / aquaPools.length) * 100).toFixed(2)}%)`
    );
    console.log(
      `⚠️ Pools with zero reserves: ${poolsWithZeroReserves} (${(
        (poolsWithZeroReserves / aquaPools.length) *
        100
      ).toFixed(2)}%)`
    );
    console.log(
      `🔄 stable pools: ${stablePools} (${((stablePools / aquaPools.length) * 100).toFixed(2)}%)`
    );
    console.log(
      `🔄 stable pools with data: ${stablePoolsWithData} (${((stablePoolsWithData / stablePools || 1) * 100).toFixed(2)}%)`
    );
    console.log(
      `🔄 Pools with three tokens: ${poolsWithThreeTokens} (${((poolsWithThreeTokens / aquaPools.length) * 100).toFixed(2)}%)`
    );
    console.log(
      `🔄 Pools with three reserves: ${poolsWithThreeReserves} (${((poolsWithThreeReserves / aquaPools.length) * 100).toFixed(2)}%)`
    );
  } catch (error) {
    console.error("❌ General error:", error);

    // Additional diagnostic information
    console.log(`⚠️ Additional diagnostic information:`);
    console.log(`🌐 Network: ${process.env.NETWORK}`);
    console.log(`🔌 Endpoint: ${process.env.SOROBAN_ENDPOINT}`);
    console.log(`📝 Aqua Factory contract: ${FACTORY_CONTRACT_AQUA}`);

    // Save emergency checkpoint
    if (aquaPools.length > 0) {
      const emergencyPath = path.join(__dirname, "../aquapools-emergency.json");
      fs.writeFileSync(emergencyPath, JSON.stringify(aquaPools, null, 2));
      console.log(`🆘 Data saved in ${emergencyPath}`);
    }

    throw error;
  }
}
