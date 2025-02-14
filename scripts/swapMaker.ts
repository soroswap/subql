import { Server } from '@stellar/stellar-sdk/rpc';
import { Contract, Address, xdr, nativeToScVal, Keypair, TransactionBuilder } from '@stellar/stellar-sdk';
import { tokenList } from '../src/mappings/tokenlist';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Configuración de la red Mainnet
const NETWORK = {
    PASSPHRASE: "Public Global Stellar Network ; September 2015",
    RPC_URL: "https://mainnet.stellar.validationcloud.io/v1/qeL7PnqAked5yWlf6KjhZuMPb_9xxaoNw4OXZCQgeAc"
};

const server = new Server(NETWORK.RPC_URL);

// Configurar la cuenta desde la clave privada en .env
const sourceKeypair = Keypair.fromSecret(process.env.SECRET_KEY_SWAPMAKER as string);

// Función para obtener la dirección del router de Soroswap
async function getSoroswapRouter() {
    try {
        const response = await axios.get('https://api.soroswap.finance/api/mainnet/router');
        return response.data.address;
    } catch (error) {
        console.error('Error obteniendo dirección del router:', error);
        throw error;
    }
}

// Función para obtener el timestamp actual + 1 hora
function getCurrentTimePlusOneHour(): number {
    return Math.floor(Date.now() / 1000) + 3600;
}

// Función para crear un par de trading
async function createTradingPair(tokenA: string, tokenB: string) {
    // Asegurarse que tokenA sea lexicográficamente menor que tokenB
    if (tokenA > tokenB) {
        [tokenA, tokenB] = [tokenB, tokenA];
    }
    return { tokenA, tokenB };
}

// Función para agregar liquidez
async function addLiquidity(
    routerAddress: string,
    tokenA: string,
    tokenB: string,
    amountADesired: bigint,
    amountBDesired: bigint
) {
    try {
        const contractInstance = new Contract(routerAddress);
        
        const addLiquidityParams: xdr.ScVal[] = [
            new Address(tokenA).toScVal(),
            new Address(tokenB).toScVal(),
            nativeToScVal(amountADesired, { type: "i128" }),
            nativeToScVal(amountBDesired, { type: "i128" }),
            nativeToScVal(0n, { type: "i128" }), // amount_a_min
            nativeToScVal(0n, { type: "i128" }), // amount_b_min
            new Address(sourceKeypair.publicKey()).toScVal(),
            nativeToScVal(getCurrentTimePlusOneHour(), { type: "u64" })
        ];

        // Crear la operación de contrato
        const operation = contractInstance.call("add_liquidity", ...addLiquidityParams);
        
        // Obtener la cuenta actual
        const account = await server.getAccount(sourceKeypair.publicKey());
        
        // Construir la transacción
        const tx = new TransactionBuilder(account, {
            fee: "100000", // Fee en stroops (0.01 XLM)
            networkPassphrase: NETWORK.PASSPHRASE
        })
        .addOperation(operation)
        .setTimeout(30)
        .build();

        // Firmar y enviar la transacción
        tx.sign(sourceKeypair);
        const response = await server.sendTransaction(tx);
        
        console.log(`Liquidez agregada para el par ${tokenA}-${tokenB}`);
        return response;
    } catch (error) {
        console.error(`Error agregando liquidez para el par ${tokenA}-${tokenB}:`, error);
        throw error;
    }
}

// Función principal para procesar todos los pares de tokens
async function processAllPairs() {
    try {
        // Verificar que la clave privada está disponible
        if (!process.env.SECRET_KEY_SWAPMAKER) {
            throw new Error('La clave privada no está definida en el archivo .env');
        }

        const routerAddress = await getSoroswapRouter();
        
        // Cantidad base de liquidez a agregar (ajustar según necesidades)
        const BASE_LIQUIDITY_A = BigInt(1000000000); // 1000 tokens con 7 decimales
        const BASE_LIQUIDITY_B = BigInt(1000000000);

        console.log(`Iniciando proceso con la cuenta: ${sourceKeypair.publicKey()}`);

        // Procesar cada par posible de tokens
        for (let i = 0; i < tokenList.length; i++) {
            for (let j = i + 1; j < tokenList.length; j++) {
                const { tokenA, tokenB } = await createTradingPair(tokenList[i], tokenList[j]);
                
                console.log(`Procesando par: ${tokenA} - ${tokenB}`);
                
                try {
                    await addLiquidity(
                        routerAddress,
                        tokenA,
                        tokenB,
                        BASE_LIQUIDITY_A,
                        BASE_LIQUIDITY_B
                    );
                    
                    // Esperar un poco entre operaciones para no sobrecargar la red
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.error(`Error procesando par ${tokenA}-${tokenB}:`, error);
                    continue; // Continuar con el siguiente par si hay error
                }
            }
        }
        
        console.log('Procesamiento de todos los pares completado');
        
    } catch (error) {
        console.error('Error en el procesamiento principal:', error);
        throw error;
    }
}

// Ejecutar el script
processAllPairs().catch(console.error);
