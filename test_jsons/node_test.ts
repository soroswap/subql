import * as fs from 'fs';
import * as path from 'path';

// Interfaz para simular el tipo de retorno que espera el mapping
interface ReservesResult {
    reserve0: string;  // Cambiado de bigint a string
    reserve1: string;  // Cambiado de bigint a string
}

function extractReserves(event: any): ReservesResult {
    let reserve0 = BigInt(0);
    let reserve1 = BigInt(0);

    // Verificar si tenemos la estructura correcta
    const values = event?.value?._value;
    if (!Array.isArray(values)) {
        console.error('No se encontró el array de valores');
        return { 
            reserve0: reserve0.toString(), 
            reserve1: reserve1.toString() 
        };
    }

    // Recorrer los valores buscando las reservas
    values.forEach((entry: any) => {
        try {
            // Obtener la key (nombre) del valor
            const keyBuffer = entry?._attributes?.key?._value?.data;
            if (!keyBuffer) return;

            // Convertir el buffer a string
            const keyString = Buffer.from(keyBuffer).toString();
            console.log('Key encontrada:', keyString);

            // Obtener el valor numérico
            const value = entry?._attributes?.val?._value?._attributes?.lo?._value;
            if (!value) return;

            console.log('Valor encontrado para', keyString + ':', value);

            // Asignar el valor según la key
            if (keyString === 'new_reserve_0') {
                reserve0 = BigInt(value);
            } else if (keyString === 'new_reserve_1') {
                reserve1 = BigInt(value);
            }
        } catch (error) {
            console.warn('Error procesando entrada:', error);
        }
    });

    // Convertir los BigInt a string antes de devolverlos
    return {
        reserve0: reserve0.toString(),
        reserve1: reserve1.toString()
    };
}

function loadEventData(): any {
    try {
        const eventFilePath = path.join(__dirname, 'event_hard.json');
        const rawData = fs.readFileSync(eventFilePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        throw new Error(`Error al leer event_hard.json: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
}

function runTest() {
    try {
        console.log('=== Ejecutando prueba ===');
        const eventData = loadEventData();
        
        // Verificar la estructura del valor
        if (eventData?.value?._value) {
            console.log('Estructura del valor encontrada');
            const reserves = extractReserves(eventData);
            
            console.log('=== Reservas Extraídas ===');
            console.log(`Reserve0: ${reserves.reserve0}`);
            console.log(`Reserve1: ${reserves.reserve1}`);
            
            const formatReserve = (value: string): string => {
                try {
                    return (Number(value) / 1e7).toFixed(7);
                } catch (error) {
                    return 'Error: Valor demasiado grande para convertir';
                }
            };
            
            console.log(`Reserve0 (normalizado): ${formatReserve(reserves.reserve0)}`);
            console.log(`Reserve1 (normalizado): ${formatReserve(reserves.reserve1)}`);

            // Probar la serialización JSON
            console.log('=== Prueba de serialización JSON ===');
            console.log(JSON.stringify({ reserves }));
        } else {
            console.error('No se encontró la estructura de valor esperada en el evento');
        }
    } catch (error) {
        console.error('Error en la prueba:', error);
        if (error instanceof Error) {
            console.error('Mensaje:', error.message);
        }
    }
}

runTest();
