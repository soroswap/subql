import { xdr, Contract, Address, rpc, scValToNative } from "@stellar/stellar-sdk";
import 'dotenv/config';

// Default Soroban endpoint
const SOROBAN_ENDPOINT = process.env.SOROBAN_ENDPOINT || 'https://soroban-testnet.stellar.org';
const server = new rpc.Server(SOROBAN_ENDPOINT, { allowHttp: true });


async function main() {
  try {
    const contractId = "CASUGCN324QMLAPWG5IUSXCFD3GZSREDEH54VJCP5MOBOEXDKWSYR2TS";
    
    // Para datos de tipo instance, usamos scvLedgerKeyContractInstance
    const instanceKey = xdr.ScVal.scvLedgerKeyContractInstance();
    
    // Obtenemos todos los datos de la instancia
    const response = await server.getContractData(contractId, instanceKey);
    
    if (response) {
      // Decodificamos los datos de la instancia
      const storage = response.val.contractData().val().instance().storage();
      
      // Creamos un objeto para almacenar todos los valores
      const contractValues: { [key: string]: any } = {};
      
      // Iteramos sobre el storage para obtener todos los valores
      storage?.forEach((entry) => {
        const key = scValToNative(entry.key());
        const value = scValToNative(entry.val());
        contractValues[key] = value;
      });

      console.log("Datos del contrato:");
      console.log(contractValues);
      //console.log(JSON.stringify(contractValues, null, 2));
      
      // Si quieres obtener un valor específico
      console.log("\nValores específicos:");
      console.log("ReserveA:", contractValues["ReserveA"]);
      console.log("ReserveB:", contractValues["ReserveB"]);
      console.log("TotalShares:", contractValues["TotalShares"]);
    }

  } catch (error) {
    console.error("Error al obtener datos del contrato:", error);
    if (error.response?.data) {
      console.error("Detalles del error:", error.response.data);
    }
  }
}

// Ejecutar la función principal
main().catch(console.error);

