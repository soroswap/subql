import * as fs from 'fs';
import * as path from 'path';
import { StrKey } from '@stellar/stellar-sdk';

interface NewPairResult {
    tokenA: string;
    tokenB: string;
    address: string;
    newPairsLength: number;
}

function hexToSorobanAddress(hexString: string): string {
    // Convertir string hex a Buffer
    const buffer = Buffer.from(hexString, 'hex');
    // Convertir a formato de dirección Soroban (C...)
    return StrKey.encodeContract(buffer);
}

function extractValuesNewPair(event: any): NewPairResult {
    // Valores por defecto
    let tokenA = '';
    let tokenB = '';
    let address = '';
    let newPairsLength = 0;

    // Extraer los datos del evento
    const values = event?._value;
   
    if (!Array.isArray(values)) {
        console.error('❌ No se encontró el array de valores en el evento NewPair');
        return {
            tokenA,
            tokenB,
            address,
            newPairsLength
        };
    }

    console.log("\n🟣🟣🟣🟣 Processing NewPair event:");
    
    // Procesar cada valor del evento
    values.forEach((entry: any) => {
        try {
            console.log("\n--- Processing entry ---");
            
            // Mostrar entrada completa
            console.log("Complete entry:");
            console.log(entry);

            const keyBuffer = entry?._attributes?.key?._value.data;
            if (!keyBuffer) {
                console.log("❌ keyBuffer not found");
                return;
            }

            const keyText = Buffer.from(keyBuffer).toString();
            console.log('Key (Text):', keyText);
            
            const value = entry?._attributes?.val?._switch?._value;
            console.log('Valor:', value);

            switch(keyText) {
                case 'token_0':
                    const tokenABuffer = entry?._attributes?.val?._value?._value?.data;
                    if (tokenABuffer) {
                        tokenA = Buffer.from(tokenABuffer).toString('hex');
                        const tokenAAddress = hexToSorobanAddress(tokenA);
                        console.log('→ Token A actualizado:', tokenA);
                        console.log('→ Token A dirección:', tokenAAddress);
                    }
                    break;
                case 'token_1':
                    const tokenBBuffer = entry?._attributes?.val?._value?._value?.data;
                    if (tokenBBuffer) {
                        tokenB = Buffer.from(tokenBBuffer).toString('hex');
                        const tokenBAddress = hexToSorobanAddress(tokenB);
                        console.log('→ Token B actualizado:', tokenB);
                        console.log('→ Token B dirección:', tokenBAddress);
                    }
                    break;
                case 'pair':
                    const pairBuffer = entry?._attributes?.val?._value?._value?.data;
                    if (pairBuffer) {
                        address = Buffer.from(pairBuffer).toString('hex');
                        const pairAddress = hexToSorobanAddress(address);
                        console.log('→ Dirección del par actualizada:', address);
                        console.log('→ Dirección del par en formato Soroban:', pairAddress);
                    }
                    break;
                case 'new_pairs_length':
                    newPairsLength = parseInt(entry?._attributes?.val?._value || '0');
                    console.log('→ Longitud de nuevos pares actualizada:', newPairsLength);
                    break;
                default:
                    console.log('⏩ Key no reconocida:', keyText);
            }
        } catch (error) {
            console.warn('❌ Error processing entry:', error);
        }
    });
   
    // Verificar que tenemos todos los datos necesarios
    console.log('\n🟣🟣🟣🟣 Resultado final:');
    console.log(`Token A: ${tokenA}`);
    console.log(`Token B: ${tokenB}`);
    console.log(`Dirección: ${address}`);
    console.log(`Nuevos pares length: ${newPairsLength}`);

    if (!tokenA || !tokenB || !address || !newPairsLength) {
        console.error('❌ Datos incompletos en el evento NewPair');
    }
   
    return {
        tokenA,
        tokenB,
        address,
        newPairsLength
    };
}

function loadEventData(): any {
    try {
        const eventFilePath = path.join(__dirname, 'event_newpair.json');
        const rawData = fs.readFileSync(eventFilePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        throw new Error(`Error al leer event_newpair.json: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
}

function runTest() {
    try {
        console.log('=== Ejecutando prueba de NewPair ===');
        const eventData = loadEventData();
        
        console.log("🔴🔴🔴🔴 Datos del evento:");
        console.log(eventData);

        if (eventData?._value) {
            console.log('✅ Estructura del valor encontrada');
            const newPairData = extractValuesNewPair(eventData);
            
            console.log('=== Datos del nuevo par extraídos ===');
            console.log(JSON.stringify(newPairData, null, 2));
        } else {
            console.error('❌ No se encontró la estructura de valor esperada en el evento');
        }
    } catch (error) {
        console.error('Error en la prueba:', error);
        if (error instanceof Error) {
            console.error('Mensaje:', error.message);
        }
    }
}

runTest();