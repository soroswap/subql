import * as fs from 'fs';
import * as path from 'path';
import { StrKey } from '@stellar/stellar-sdk';

interface SwapAquaResult {
    user: string;
    tokenIn: string;
    tokenOut: string;
    inAmount: bigint;
    outMin: bigint;
}

function hexToSorobanAddress(hexString: string): string {
    const buffer = Buffer.from(hexString, 'hex');
    return StrKey.encodeContract(buffer);
}

function extractSwapAquaValues(event: any): SwapAquaResult {
    let result = {
        user: '',
        tokenIn: '',
        tokenOut: '',
        inAmount: BigInt(0),
        outMin: BigInt(0)
    };

    try {
        // Extraer los valores del evento
        const values = event?._value;
        if (!Array.isArray(values)) {
            console.error('❌ No se encontró el array de valores en el evento Swap');
            return result;
        }

        console.log("\n🔄 Procesando evento Swap Aqua:");

        // Los primeros tres valores son direcciones (user, tokenIn, tokenOut)
        if (values.length >= 3) {
            // User address (primer valor)
            const userBuffer = values[0]?._arm === 'address' ? 
                values[0]?._value?._value?.data : null;
            if (userBuffer) {
                result.user = hexToSorobanAddress(Buffer.from(userBuffer).toString('hex'));
                console.log('→ User address:', result.user);
            }

            // Token In (segundo valor)
            const tokenInBuffer = values[1]?._arm === 'address' ? 
                values[1]?._value?._value?.data : null;
            if (tokenInBuffer) {
                result.tokenIn = hexToSorobanAddress(Buffer.from(tokenInBuffer).toString('hex'));
                console.log('→ Token In:', result.tokenIn);
            }

            // Token Out (tercer valor)
            const tokenOutBuffer = values[2]?._arm === 'address' ? 
                values[2]?._value?._value?.data : null;
            if (tokenOutBuffer) {
                result.tokenOut = hexToSorobanAddress(Buffer.from(tokenOutBuffer).toString('hex'));
                console.log('→ Token Out:', result.tokenOut);
            }

            // In Amount (cuarto valor)
            const inAmount = values[3]?._arm === 'u128' ? 
                values[3]?._value?._attributes?.lo?._value : null;
            if (inAmount) {
                result.inAmount = BigInt(inAmount);
                console.log('→ In Amount:', result.inAmount.toString());
            }

            // Out Min (quinto valor)
            const outMin = values[4]?._arm === 'u128' ? 
                values[4]?._value?._attributes?.lo?._value : null;
            if (outMin) {
                result.outMin = BigInt(outMin);
                console.log('→ Out Min:', result.outMin.toString());
            }
        }

        // Verificar que tenemos todos los datos necesarios
        console.log('\n📊 Resultado final:');
        console.log('User:', result.user);
        console.log('Token In:', result.tokenIn);
        console.log('Token Out:', result.tokenOut);
        console.log('In Amount:', result.inAmount.toString());
        console.log('Out Min:', result.outMin.toString());

        if (!result.user || !result.tokenIn || !result.tokenOut) {
            console.error('❌ Datos incompletos en el evento Swap');
        }

        return result;

    } catch (error) {
        console.error('❌ Error procesando evento Swap:', error);
        return result;
    }
}

function loadEventData(): any {
    try {
        const eventFilePath = path.join(__dirname, 'event_swap_aqua.json');
        const rawData = fs.readFileSync(eventFilePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        throw new Error(`Error al leer event_swap_aqua.json: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
}

function runTest() {
    try {
        console.log('=== Ejecutando prueba de Swap Aqua ===');
        const eventData = loadEventData();
        
        console.log("🔴 Datos del evento raw:");
        //console.log(JSON.stringify(eventData, null, 2));

        if (eventData) {
            console.log('✅ Estructura del evento encontrada');
            const swapData = extractSwapAquaValues(eventData);
            
            console.log('=== Datos del swap extraídos ===');
            console.log(JSON.stringify({
                ...swapData,
                inAmount: swapData.inAmount.toString(),
                outMin: swapData.outMin.toString()
            }, null, 2));
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
