import * as fs from 'fs';
import * as path from 'path';

function extractReserves(scvMap: any): { reserve0: bigint, reserve1: bigint } {
      const entries = scvMap._value;
      
      let reserve0 = BigInt(0);
      let reserve1 = BigInt(0);
      
      if (!Array.isArray(entries)) {
        throw new Error('El mapa de valores no tiene el formato esperado');
      }
      
      entries.forEach((entry: any) => {
        if (!entry?._attributes?.key?._value?.data || !entry?._attributes?.val?._value?._attributes?.lo?._value) {
          throw new Error('Entrada del mapa con formato inválido');
        }
        
        const keyBuffer = entry._attributes.key._value.data;
        const keyString = Buffer.from(keyBuffer).toString();
        
        // Validar que el valor sea un número válido antes de convertirlo
        const valueStr = entry._attributes.val._value._attributes.lo._value;
        if (!/^\d+$/.test(valueStr)) {
          throw new Error(`Valor inválido para la reserva: ${valueStr}`);
        }
        
        const value = BigInt(valueStr);
        
        if (keyString === 'new_reserve_0') {
          reserve0 = value;
        } else if (keyString === 'new_reserve_1') {
          reserve1 = value;
        }
      });
      
      return { reserve0, reserve1 };
    }
    
// Leer datos desde el archivo value.json
function loadValueData(): any {
    try {
        const valueFilePath = path.join(__dirname, 'value.json');
        const rawData = fs.readFileSync(valueFilePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        throw new Error(`Error al leer value.json: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
}

// Leer datos desde el archivo event.json
function loadEventData(): any {
    try {
        const eventFilePath = path.join(__dirname, 'event.json');
        const rawData = fs.readFileSync(eventFilePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        throw new Error(`Error al leer event.json: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
}

// Función de prueba
function runTest() {
    try {
        console.log('=== Ejecutando prueba ===');
        
        // Cargar datos desde archivos JSON
        const valueData = loadValueData();
        const eventData = loadEventData();
        
        const reserves = extractReserves(valueData);
        
        console.log('=== Información del Evento ===');
        console.log(`Ledger: ${eventData.ledger.sequence}`);
        console.log(`Timestamp: ${eventData.ledger.closed_at}`);
        console.log('========================\n');

        console.log('=== Reservas ===');
        console.log(`Reserve0: ${reserves.reserve0.toString()}`);
        console.log(`Reserve1: ${reserves.reserve1.toString()}`);
        
        // Usar una función auxiliar para el formateo
        const formatReserve = (value: bigint): string => {
            try {
                return (Number(value) / 1e7).toFixed(7);
            } catch (error) {
                return 'Error: Valor demasiado grande para convertir';
            }
        };
        
        console.log(`Reserve0 (normalizado): ${formatReserve(reserves.reserve0)}`);
        console.log(`Reserve1 (normalizado): ${formatReserve(reserves.reserve1)}`);

    } catch (error) {
        console.error('Error en la prueba:', error);
        if (error instanceof Error) {
            console.error('Mensaje:', error.message);
        }
    }
}

// Ejecutar la prueba
runTest();