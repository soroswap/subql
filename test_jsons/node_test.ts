import * as fs from 'fs';
import * as path from 'path';

function extractReserves(scvMap: any): { reserve0: bigint, reserve1: bigint } {
      // Asumimos que el mapa tiene la estructura correcta
      const entries = scvMap._value;
      
      let reserve0 = BigInt(0);
      let reserve1 = BigInt(0);
      
      entries.forEach((entry: any) => {
        // Convertir el Buffer a string para identificar qué reserva es
        const keyBuffer = entry._attributes.key._value.data;
        const keyString = Buffer.from(keyBuffer).toString();
        
        // Obtener el valor de lo
        const value = BigInt(entry._attributes.val._value._attributes.lo._value);
        
        if (keyString === 'new_reserve_0') {
          reserve0 = value;
        } else if (keyString === 'new_reserve_1') {
          reserve1 = value;
        }
      });
      
      return { reserve0, reserve1 };
    }
    
// Agregar datos de prueba
const mockValueData = {
  _value: [
    {
      _attributes: {
        key: { _value: { data: Buffer.from('new_reserve_0') } },
        val: { _value: { _attributes: { lo: { _value: '1000000000' } } } }
      }
    },
    {
      _attributes: {
        key: { _value: { data: Buffer.from('new_reserve_1') } },
        val: { _value: { _attributes: { lo: { _value: '2000000000' } } } }
      }
    }
  ]
};

const mockEventData = {
  ledger: {
    sequence: 123456,
    closed_at: '2024-03-20T12:00:00Z'
  }
};

// Función de prueba
function runTest() {
    try {
        console.log('=== Ejecutando prueba ===');
        
        // Usar datos mock en lugar de leer archivos
        const reserves = extractReserves(mockValueData);
        
        console.log('=== Información del Evento ===');
        console.log(`Ledger: ${mockEventData.ledger.sequence}`);
        console.log(`Timestamp: ${mockEventData.ledger.closed_at}`);
        console.log('========================\n');

        console.log('=== Reservas ===');
        console.log(`Reserve0: ${reserves.reserve0.toString()}`);
        console.log(`Reserve1: ${reserves.reserve1.toString()}`);
        
        console.log(`Reserve0 (normalizado): ${(Number(reserves.reserve0) / 1e7).toFixed(7)}`);
        console.log(`Reserve1 (normalizado): ${(Number(reserves.reserve1) / 1e7).toFixed(7)}`);

    } catch (error) {
        console.error('Error en la prueba:', error);
    }
}

// Ejecutar la prueba en lugar de main()
runTest();