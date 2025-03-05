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

    console.log("\n🟣🟣🟣🟣 Procesando reservas:");
    values.forEach((entry: any) => {
        try {
            console.log("\n--- Procesando entrada ---");
            
            // Mostrar entrada completa
            console.log("Entrada completa:");
            console.log(entry);
            console.log("🔴🔴🔴🔴 entry attributes");
            //console.log(entry._attributes.val)
            console.log(entry._attributes.val)
            console.log(entry._attributes.val._value)
            // Obtener y mostrar la key como buffer y texto
            const keyBuffer = entry?._attributes?.key?._value?.data;
            console.log("🔴🔴🔴🔴 keyBuffer");
            console.log(keyBuffer)
            if (!keyBuffer) {
                console.log("❌ No se encontró keyBuffer");
                return;
            }
            const keyText = Buffer.from(keyBuffer).toString();
            console.log('Key (Buffer):', entry._attributes.key);
            console.log('Key (Text):', keyText);

            // Solo procesar si la key es new_reserve_0 o new_reserve_1
            if (!keyText.includes('new_reserve_')) {
                console.log('⏩ Ignorando key que no es de reserva:', keyText);
                return;
            }

            // Obtener y mostrar el valor completo y sus detalles
            console.log('Val completo:', entry._attributes.val);
            const value = entry?._attributes?.val?._value?._attributes?.lo?._value;
            
            if (!value) {
                console.log("❌ No se encontró valor numérico");
                return;
            }

            console.log('✅ Valor final encontrado:', value);

            // Asignar el valor según la key
            if (keyText === 'new_reserve_0') {
                reserve0 = BigInt(value);
                console.log('→ Actualizado reserve0:', reserve0.toString());
            } else if (keyText === 'new_reserve_1') {
                reserve1 = BigInt(value);
                console.log('→ Actualizado reserve1:', reserve1.toString());
            }
        } catch (error) {
            console.warn('❌ Error procesando entrada:', error);
        }
    });

    console.log('\n🟣🟣🟣🟣 Resultado final:');
    console.log(`reserve0: ${reserve0.toString()}`);
    console.log(`reserve1: ${reserve1.toString()}`);

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
    function loadEventData2(): any {
        try {
            const eventFilePath = path.join(__dirname, 'event.json');
            const rawData = fs.readFileSync(eventFilePath, 'utf8');
            return JSON.parse(rawData);
        } catch (error) {
            throw new Error(`Error al leer event_hard.json: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
    }

function runTest() {
    try {
        
        console.log('=== Ejecutando prueba ===');
        const eventData2 = loadEventData2();
        console.log("🔴🔴🔴🔴 eventData2");
        console.log(eventData2)
        const eventData = loadEventData();
        console.log("🔴🔴🔴🔴 eventData");
        console.log(eventData)
        console.log("🔴🔴🔴🔴eventData.value");
        console.log(eventData.value);
        console.log("🔴🔴🔴🔴eventData2.value");
        console.log(eventData2.value);
        console.log("🔴🔴🔴🔴eventData.value._value");
        console.log(eventData.value._value);
        // // console.log("🔴🔴🔴🔴 eventData.value._value.key");
        // // console.log(eventData.value._value._attributes.key);
        // // console.log("🔴🔴🔴🔴NATIVE eventData.value._value.key");
        // // console.log(scValToNative(eventData.value._value._attributes.key));

        // // Agregar nuevos logs para mostrar key y val
        // console.log("\n🔵🔵🔵🔵 Detalles de key y val:");
        // eventData.value._value.forEach((item: any, index: number) => {
        //     console.log(`\nÍtem ${index + 1}:`);
            
        //     // Mostrar Key con el buffer convertido a texto
        //     const keyBuffer = item._attributes.key._value.data;
        //     const keyText = Buffer.from(keyBuffer).toString();
 
        //     //console.log('Key (Buffer):', item._attributes.key);
        //     console.log('Key (Text):', keyText);

        //     // Mostrar Val con los detalles del objeto lo
        //     //console.log('Val:', item._attributes.val);
        //     console.log('Val lo details:', item._attributes.val._value._attributes.lo._value);
        // });
        // Verificar la estructura del valor
        if (eventData2?.value?._value) {
            console.log('✅ Estructura del valor encontrada');
            const reserves = extractReserves(eventData2);
            
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
