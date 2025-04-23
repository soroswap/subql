import { invokeCustomContract } from "soroban-toolkit";
import { Keypair, scValToNative, xdr, nativeToScVal, ScInt, rpc } from "@stellar/stellar-sdk";
import * as fs from "fs";
import * as path from "path";
import { toolkit } from "../toolkit";
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

// Funciones para interactuar con el contrato
async function getTokenSetsCount(): Promise<number> {
  try {
    const result = await invokeCustomContract(
      toolkit,
      FACTORY_CONTRACT_AQUA,
      "get_tokens_sets_count",
      [],
      true,
      Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
    );
    return Number(scValToNative(result.result.retval));
  } catch (error) {
    console.error("❌ Error obteniendo el número total de token sets:", error);
    throw error;
  }
}

async function getTokens(index: number): Promise<string[]> {
  try {
    const indexScVal = new ScInt(BigInt(index)).toU128();
    const result = await invokeCustomContract(
      toolkit,
      FACTORY_CONTRACT_AQUA,
      "get_tokens",
      [indexScVal],
      true,
      Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
    );
    return scValToNative(result.result.retval) as string[];
  } catch (error) {
    console.error(`❌ Error obteniendo tokens para índice ${index}:`, error);
    throw error;
  }
}

async function getPools(tokens: string[]): Promise<{ [key: string]: string }> {
  try {
    const tokenScVals = tokens.map((token) => nativeToScVal(token, { type: "address" }));

    const result = await invokeCustomContract(
      toolkit,
      FACTORY_CONTRACT_AQUA,
      "get_pools",
      [xdr.ScVal.scvVec(tokenScVals)],
      true,
      Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
    );
    return scValToNative(result.result.retval) as { [key: string]: string };
  } catch (error) {
    console.error("❌ Error obteniendo pools para tokens:", tokens, error);
    throw error;
  }
}

async function getPoolType(contract: string): Promise<string> {
  try {
    const result = await invokeCustomContract(
      toolkit,
      contract,
      "pool_type",
      [],
      true,
      Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
    );
    return scValToNative(result.result.retval) as string;
  } catch (error) {
    console.error(`❌ Error obteniendo tipo de pool para ${contract}:`, error);
    return "";
  }
}

async function getPoolFee(contract: string): Promise<string> {
  try {
    const result = await invokeCustomContract(
      toolkit,
      contract,
      "get_fee_fraction",
      [],
      true,
      Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
    );
    return scValToNative(result.result.retval) as string;
  } catch (error) {
    console.error(`❌ Error obteniendo fee para ${contract}:`, error);
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

    // Para datos de tipo instancia, usamos scvLedgerKeyContractInstance
    const instanceKey = xdr.ScVal.scvLedgerKeyContractInstance();

    // Obtener todos los datos de la instancia
    const response = await server.getContractData(poolAddress, instanceKey);

    if (response) {
      // Decodificar datos de la instancia
      const storage = response.val.contractData().val().instance().storage();

      // Crear un objeto para almacenar todos los valores
      const contractValues: { [key: string]: any } = {};

      // Iterar a través del almacenamiento para obtener todos los valores
      storage?.forEach((entry) => {
        const key = scValToNative(entry.key());
        const value = scValToNative(entry.val());
        contractValues[key] = value;
      });

      // Verificar si es un pool de tipo stable
      if (poolType === "stable") {
        // Para pools stable, buscar el array de Reserves
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
        // Para pools constant_product, buscar nombres individuales
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
    console.error(`❌ Error obteniendo reservas para pool ${poolAddress}:`, error);
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

    // Para datos de tipo instancia, usamos scvLedgerKeyContractInstance
    const instanceKey = xdr.ScVal.scvLedgerKeyContractInstance();

    // Obtener todos los datos de la instancia
    const response = await server.getContractData(poolAddress, instanceKey);

    if (response) {
      // Decodificar datos de la instancia
      const storage = response.val.contractData().val().instance().storage();

      // Crear un objeto para almacenar todos los valores
      const contractValues: { [key: string]: any } = {};

      // Iterar a través del almacenamiento para obtener todos los valores
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


// Función principal simplificada
export async function getAquaPreStart(): Promise<void> {
  const aquaPools: AquaPool[] = [];
  const failedIndices: number[] = [];
  const poolAddressSet = new Set<string>(); // Para evitar duplicados

  try {
    console.log("🚀 Iniciando generación de lista de pools de Aqua...");

    // Obtener total de sets
    const totalSets = await getTokenSetsCount();
    console.log(`📊 Total de sets de tokens: ${totalSets}`);

    const pLimit = await getPLimit(); // Adjust concurrency limit as needed
    const limit = pLimit(20); // Adjust concurrency level
    const tasks = Array.from({ length: totalSets }, (_, i) =>
      limit(async () => {
        try {
          console.log(
            `🔍 Procesando índice ${i}/${totalSets - 1} (${(((i + 1) / totalSets) * 100).toFixed(
              1
            )}%)`
          );

          const tokens = await getTokens(i);
          if (!tokens || tokens.length < 2) {
            console.warn(`⚠️ Tokens inválidos para índice ${i}`);
            return;
          }

          const pools = await getPools(tokens);
          if (!pools || Object.keys(pools).length === 0) {
            console.warn(`⚠️ No se encontraron pools para índice ${i}`);
            return;
          }

          console.log(
            `📊 Encontrados ${Object.keys(pools).length} pools para tokens [${tokens[0]}, ${
              tokens[1]
            }]`
          );

          for (const key in pools) {
            const poolAddress = pools[key];

            if (poolAddressSet.has(poolAddress)) {
              console.log(`⏭️ Pool ${poolAddress} ya procesado, saltando...`);
              continue;
            }

            poolAddressSet.add(poolAddress);

            const poolData: AquaPool = {
              tokenA: tokens[0],
              tokenB: tokens[1],
              address: poolAddress,
            };
            
            if (tokens.length >= 3) {
              poolData.tokenC = tokens[2];
              console.log(`ℹ️ pool with third token: ${tokens[2]}`);
            }

            const poolType = await getPoolType(poolAddress);
            if (poolType) {
              poolData.poolType = poolType;
              console.log(`ℹ️ Tipo de pool para ${poolAddress}: ${poolType}`);
            }

            const fee = await getPoolFee(poolAddress);
            if (fee) {
              poolData.fee = fee.toString();
              console.log(`💰 Fee del pool ${poolAddress}: ${fee}`);
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

          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`❌ Error en índice ${i}:`, error);
          failedIndices.push(i);
        }
      })
    );

    await Promise.all(tasks);

    // Generar contenido del archivo
    const fileContent = `
// Este archivo fue generado automáticamente por aquaPoolsTokensMaker.ts
// No modificar manualmente

// Total de pools: ${aquaPools.length}

export interface AquaPool {
    tokenA: string;
    tokenB: string;
    tokenC?: string;
    address: string;
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

    // Escribir archivo
    const filePath = path.join(outputDir, "aquaPools.ts");
    fs.writeFileSync(filePath, fileContent);
    console.log(`\n✅ aquaPools.ts generado exitosamente en ${filePath}`);

    // Estadísticas finales
    console.log("\n📊 Resumen de ejecución:");
    console.log(`✅ Total de pools guardados: ${aquaPools.length}`);

    if (failedIndices.length > 0) {
      console.log(`❌ Índices con errores: ${failedIndices.length}`);
      // Guardar errores en archivo
      const errorPath = path.join(__dirname, "../aquapools-errors.json");
      fs.writeFileSync(errorPath, JSON.stringify(failedIndices, null, 2));
      console.log(`📝 Lista de errores guardada en ${errorPath}`);
    }

    // Estadísticas adicionales
    const poolsWithReserves = aquaPools.filter((pool) => pool.reserveA && pool.reserveB).length;
    const poolsWithoutReserves = aquaPools.length - poolsWithReserves;
    const poolsWithType = aquaPools.filter((pool) => pool.poolType).length;
    const poolsWithFee = aquaPools.filter((pool) => pool.fee).length;
    const poolsWithZeroReserves = aquaPools.filter(
      (pool) => pool.reserveA === "0" && pool.reserveB === "0"
    ).length;
    const stablePools = aquaPools.filter((pool) => pool.poolType === "stable").length;
    const stablePoolsWithData = aquaPools.filter((pool) => pool.poolType === "stable" && pool.futureA).length;
    const poolsWithThreeTokens = aquaPools.filter((pool) => pool.tokenC).length;
    const poolsWithThreeReserves = aquaPools.filter((pool) => pool.reserveC).length;

    console.log(`\n📊 Estadísticas de pools`);
    console.log(
      `✅ Pools con reservas: ${poolsWithReserves} (${(
        (poolsWithReserves / aquaPools.length) *
        100
      ).toFixed(2)}%)`
    );
    console.log(
      `⚠️ Pools sin reservas: ${poolsWithoutReserves} (${(
        (poolsWithoutReserves / aquaPools.length) *
        100
      ).toFixed(2)}%)`
    );
    console.log(
      `ℹ️ Pools con tipo: ${poolsWithType} (${((poolsWithType / aquaPools.length) * 100).toFixed(
        2
      )}%)`
    );
    console.log(
      `💰 Pools con fee: ${poolsWithFee} (${((poolsWithFee / aquaPools.length) * 100).toFixed(2)}%)`
    );
    console.log(
      `⚠️ Pools con reservas cero: ${poolsWithZeroReserves} (${(
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
      `🔄 Pools con tres tokens: ${poolsWithThreeTokens} (${((poolsWithThreeTokens / aquaPools.length) * 100).toFixed(2)}%)`
    );
    console.log(
      `🔄 Pools con tres reservas: ${poolsWithThreeReserves} (${((poolsWithThreeReserves / aquaPools.length) * 100).toFixed(2)}%)`
    );
  } catch (error) {
    console.error("❌ Error general:", error);

    // Guardar checkpoint de emergencia
    if (aquaPools.length > 0) {
      const emergencyPath = path.join(__dirname, "../aquapools-emergency.json");
      fs.writeFileSync(emergencyPath, JSON.stringify(aquaPools, null, 2));
      console.log(`🆘 Datos guardados en ${emergencyPath}`);
    }

    throw error;
  }
}
