import * as fs from 'fs';
import * as path from 'path';
import { StrKey } from '@stellar/stellar-sdk';

// yarn test:deposit: "ts-node scripts/tests/event_deposit_aqua.ts"

interface AddPoolResult {
    address: string;
    tokenA: string;
    tokenB: string;
    poolType: string;
}

function hexToSorobanAddress(hexString: string): string {
    const buffer = Buffer.from(hexString, 'hex');
    return StrKey.encodeContract(buffer);
}

// Helper function para extraer valores del evento add_pool
function extractAddPoolAquaValues(event: any): AddPoolResult {
    let result = {
        address: '',
        tokenA: '',
        tokenB: '',
        poolType: ''
    };

    try {
        // Extraer user del value
        const values = event?.value?._value;
        if (!Array.isArray(values)) {
            throw new Error('No values array found in AddPool event');
        }

        console.log("\n🔄 Processing Aqua AddPool event values:");

        // User address (primer valor del value)
        const userBuffer = values[0]?._value?._value?.data;
        if (userBuffer) {
            result.address = hexToSorobanAddress(Buffer.from(userBuffer).toString('hex'));
            console.log(`→ User address: ${result.address}`);
        }
        // pool type
        const poolType = values[1]?._value?.data;
        if (poolType) {
            result.poolType = Buffer.from(poolType).toString('utf8');
            console.log(`→ Pool type: ${result.poolType}`);
        }

        // Tokens del topic[1]
        const topicTokens = event?.topic?.[1]?._value;
        if (Array.isArray(topicTokens) && topicTokens.length >= 2) {
            // Token A
            const tokenABuffer = topicTokens[0]?._value?._value?.data;
            if (tokenABuffer) {
                result.tokenA = hexToSorobanAddress(Buffer.from(tokenABuffer).toString('hex'));
                console.log(`→ Token A: ${result.tokenA}`);
            }

            // Token B
            const tokenBBuffer = topicTokens[1]?._value?._value?.data;
            if (tokenBBuffer) {
                result.tokenB = hexToSorobanAddress(Buffer.from(tokenBBuffer).toString('hex'));
                console.log(`→ Token B: ${result.tokenB}`);
            }
        }

        if (!result.address || !result.tokenA || !result.tokenB) {
            throw new Error('Incomplete data in AddPool event');
        }

        return result;

    } catch (error) {
        console.error(`❌ Error extracting Aqua AddPool values: ${error}`);
        console.error('Event data was:', JSON.stringify(event, null, 2));
        throw error;
    }
}

function loadEventData(): any {
    try {
        const eventFilePath = path.join(__dirname, 'eventCompletePool.json');
        const rawData = fs.readFileSync(eventFilePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        throw new Error(`Error al leer eventCompletePool.json: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
}

function runTest() {
    try {
        console.log('=== Ejecutando prueba de AddPool Aqua ===');
        const eventData = loadEventData();
        
        console.log("🔴 Datos del evento raw:");
        console.log(JSON.stringify(eventData, null, 2));

        if (eventData) {
            console.log('✅ Estructura del evento encontrada');
            const poolData = extractAddPoolAquaValues(eventData);
            
            console.log('=== Datos del pool extraídos ===');
            console.log(JSON.stringify(poolData, null, 2));
        } else {
            console.error('❌ No se encontró la estructura esperada en el evento');
        }
    } catch (error) {
        console.error('Error en la prueba:', error);
        if (error instanceof Error) {
            console.error('Mensaje:', error.message);
        }
    }
}

runTest();
