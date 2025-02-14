import { tokenList } from '../src/mappings/tokenlist';
import * as StellarSdk from '@stellar/stellar-sdk';
import { contractInvoke } from "@soroban-react/contracts";
import { SorobanContextType } from "@soroban-react/core";
import { rpc, 
    xdr
} from '@stellar/stellar-sdk';
import dotenv from 'dotenv';

dotenv.config();

const SOROBAN_RPC_URL = process.env.SOROBAN_ENDPOINT;
const NETWORK_PASSPHRASE = process.env.CHAIN_ID;
const SECRET_KEY = process.env.SECRET_KEY_SWAPMAKER;

if (!SOROBAN_RPC_URL || !NETWORK_PASSPHRASE || !SECRET_KEY) {
  throw new Error('Missing required environment variables');
}

const server = new rpc.Server(SOROBAN_RPC_URL, { allowHttp: true });
const sourceKeypair = StellarSdk.Keypair.fromSecret(SECRET_KEY);

async function checkAndRestorePool(poolId: string): Promise<boolean> {
  console.log(`\nChecking pool ${poolId}...`);
  
  try {
    const account = await server.getAccount(sourceKeypair.publicKey());
    const contract = new StellarSdk.Contract(poolId);
    
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE
    })
    .addOperation(contract.call("get_rsrvs"))
    .setTimeout(30)
    .build();

    console.log("Simulando transacción para verificar estado...");
    const simResult = await server.simulateTransaction(tx);

    if (rpc.Api.isSimulationSuccess(simResult)) {
      console.log("Pool activa y funcionando correctamente");
      return true;
    }

    console.log("Pool expirada, procediendo a restaurar...");
    
    const contract_instance = new StellarSdk.Address(poolId);
    const contractInstanceXDR = StellarSdk.xdr.LedgerKey.contractData(
      new StellarSdk.xdr.LedgerKeyContractData({
        contract: contract_instance.toScAddress(),
        key: StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: StellarSdk.xdr.ContractDataDurability.persistent()
      })
    );

    const restoreTx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE
    })
    .addOperation(StellarSdk.Operation.restoreFootprint({}))
    .setTimeout(30)
    .build();

    restoreTx.sign(sourceKeypair);
    
    console.log("Enviando transacción de restauración...");
    const restoreResult = await server.sendTransaction(restoreTx);
    
    // Versión simplificada: solo esperamos un tiempo fijo y verificamos
    console.log("Esperando que la transacción se procese...");
    await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
    
    // Intentar verificar el funcionamiento
    console.log("Verificando funcionamiento...");
    const verificationResult = await server.simulateTransaction(tx);
    
    if (rpc.Api.isSimulationSuccess(verificationResult)) {
      console.log("Pool restaurada y funcionando correctamente");
      return true;
    } else {
      console.log("La pool sigue sin funcionar después de la restauración");
      return false;
    }

  } catch (error) {
    console.error("Error procesando pool:", poolId);
    console.error(error);
    return false;
  }
}

async function main() {
  console.log("Iniciando proceso de verificación y restauración de pools...");
  console.log(`Total de pools a verificar: ${tokenList.length}`);

  let restored = 0;
  let failed = 0;
  let active = 0;

  for (const poolId of tokenList) {
    const success = await checkAndRestorePool(poolId);
    if (success) {
      active++;
    } else {
      failed++;
    }
  }

  console.log("\nResumen del proceso:");
  console.log(`Total de pools verificadas: ${tokenList.length}`);
  console.log(`Pools activas: ${active}`);
  console.log(`Pools que fallaron: ${failed}`);
}

main().catch(console.error);




export const restoreContract = async (
    contractId: string,
    sorobanContext: SorobanContextType
  ) => {
    const contract = Address.fromString(contractId);
    console.log("bumping contract instance: ", contract.toString());
    const contractInstanceXDR = xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: contract.toScAddress(),
        key: xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: xdr.ContractDataDurability.persistent(),
      })
    );
  
    const txBuilder = await createTxBuilder(sorobanContext);
    txBuilder.addOperation(Operation.restoreFootprint({}));
    txBuilder.setSorobanData(
      new SorobanDataBuilder().setReadWrite([contractInstanceXDR]).build()
    );
  
    const tx = txBuilder.build();
    console.log("XDR:", tx.toXDR());
    const result = await invokeTransaction(tx, false, sorobanContext);
    // @ts-ignore
    console.log(result.status, "\n");
  };
  
  class DetailedSimulationError extends Error {
    public simulationResp: rpc.Api.SimulateTransactionResponse;
  
    constructor(
      message: string,
      simulationResp: rpc.Api.SimulateTransactionResponse
    ) {
      super(message);
      this.name = "DetailedSimulationError";
      this.simulationResp = simulationResp;
      Object.setPrototypeOf(this, DetailedSimulationError.prototype);
    }
  }
  