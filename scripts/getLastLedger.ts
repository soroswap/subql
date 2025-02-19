import { rpc } from "@stellar/stellar-sdk";
import 'dotenv/config'; // Añadimos esto para cargar las variables de entorno
import * as fs from 'fs';
import * as path from 'path';

// Endpoint por defecto para Soroban
const SOROBAN_ENDPOINT = process.env.SOROBAN_ENDPOINT || 'https://soroban-testnet.stellar.org';

// Función auxiliar para obtener el último ledger
async function getLatestLedger(): Promise<number> {
    try {
      const server = new rpc.Server(SOROBAN_ENDPOINT);
      const response = await server.getLatestLedger();
      return response.sequence;
    } catch (error) {
      console.error("Error getting latest ledger:", error);
      return 0; // Valor por defecto en caso de error
    }
}

const getStartBlock = async () => {
    return parseInt(process.env.STARBLOCK!) || await getLatestLedger();
};

// Función principal que ejecuta todo
async function main() {
    const startBlock = await getStartBlock();
    console.log("startBlock: " + startBlock);
    
    // Guardamos el valor en un archivo TypeScript
    const outputPath = path.join(__dirname, 'lastLedger.ts');
    const fileContent = `
// Este archivo se genera automáticamente - no editar manualmente
export const startBlock = ${startBlock};
`;
    fs.writeFileSync(outputPath, fileContent);
}

// Ejecutar la función principal
main()
    .catch(error => {
        console.error("Error:", error);
        process.exit(1);
    });