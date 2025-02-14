import { contractInvoke } from "@soroban-react/contracts";
import { SorobanContextType } from "@soroban-react/core";
import { Asset as AssetType } from "@stellar-asset-lists/sdk";
import {
  Account,
  Address,
  Asset,
  Operation,
  SorobanDataBuilder,
  StrKey,
  rpc,
  Transaction,
  TransactionBuilder,
  hash,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

// Get the tokens symbol, decoded as a string
export const getTokenSymbol = async (
  sorobanContext: SorobanContextType,
  contractId?: string
): Promise<string | null> => {
  if (!contractId) return null;
  try {
    let result = await contractInvoke({
      contractAddress: contractId as string,
      method: "symbol",
      args: [],
      sorobanContext,
    });

    return scValToNative(result as xdr.ScVal);
  } catch (error) {
    return null;
  }
};

// Get the tokens name, decoded as a string
export const getTokenName = async (
  sorobanContext: SorobanContextType,
  contractId?: string
): Promise<string | null> => {
  if (!contractId) return null;
  try {
    let result = await contractInvoke({
      contractAddress: contractId as string,
      method: "name",
      args: [],
      sorobanContext,
    });

    return scValToNative(result as xdr.ScVal);
  } catch (error) {
    return null;
  }
};

// Get the tokens decimals, decoded as a number
export const getTokenDecimals = async (
  sorobanContext: SorobanContextType,
  contractId?: string
): Promise<number> => {
  if (!contractId) return 7;
  try {
    let result = await contractInvoke({
      contractAddress: contractId as string,
      method: "decimals",
      args: [],
      sorobanContext,
    });

    return scValToNative(result as xdr.ScVal);
  } catch (error) {
    return 7;
  }
};

export const deployStellarAsset = async (
  asset: AssetType,
  sorobanContext: SorobanContextType
) => {
  const new_asset = new Asset(asset.code, asset.issuer);
  const xdrAsset = new_asset.toXDRObject();
  const networkId = hash(
    Buffer.from(sorobanContext.activeChain?.networkPassphrase!)
  );
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId: networkId,
      contractIdPreimage:
        xdr.ContractIdPreimage.contractIdPreimageFromAsset(xdrAsset),
    })
  );
  const contractId = StrKey.encodeContract(hash(preimage.toXDR()));
  console.log("🚀 « deployed Stellar Asset:", contractId);

  const deployFunction = xdr.HostFunction.hostFunctionTypeCreateContract(
    new xdr.CreateContractArgs({
      contractIdPreimage:
        xdr.ContractIdPreimage.contractIdPreimageFromAsset(xdrAsset),
      executable: xdr.ContractExecutable.contractExecutableStellarAsset(),
    })
  );
  return await invoke(
    Operation.invokeHostFunction({
      func: deployFunction,
      auth: [],
    }),
    false,
    sorobanContext
  );
};

export async function invoke(
  operation: string | xdr.Operation,
  sim: boolean,
  sorobanContext: SorobanContextType
): Promise<any> {
  const txBuilder = await createTxBuilder(sorobanContext);
  if (typeof operation === "string") {
    operation = xdr.Operation.fromXDR(operation, "base64");
  }
  txBuilder.addOperation(operation);
  const tx = txBuilder.build();
  return invokeTransaction(tx, sim, sorobanContext);
}

export async function createTxBuilder(
  sorobanContext: SorobanContextType
): Promise<TransactionBuilder> {
  const { server, address } = sorobanContext;
  if (server && address) {
    try {
      const account: Account = await server.getAccount(address);
      return new TransactionBuilder(account, {
        fee: "10000",
        timebounds: { minTime: 0, maxTime: 0 },
        networkPassphrase: sorobanContext.activeChain?.networkPassphrase,
      });
    } catch (e: any) {
      console.error(e);
      throw Error("unable to create txBuilder");
    }
  }
  throw Error("server is underfined");
}

export async function invokeTransaction(
  tx: Transaction,
  sim: boolean,
  sorobanContext: SorobanContextType
) {
  console.log("🚀 « tx:", tx);
  const { address, server } = sorobanContext;
  if (!server || !address) return;
  // simulate the TX
  const simulation_resp = await server.simulateTransaction(tx);
  console.log("🚀 « simulation_resp:", simulation_resp);
  if (SorobanRpc.Api.isSimulationError(simulation_resp)) {
    // No resource estimation available from a simulation error. Allow the response formatter
    // to fetch the error.
    throw new DetailedSimulationError(
      "Simulation failed due to an error",
      simulation_resp
    );
  } else if (sim) {
    // Only simulate the TX. Assemble the TX to borrow the resource estimation algorithm in
    return simulation_resp;
  }
  console.log("🚀 « simulation_resp:", simulation_resp);

  // assemble and sign the TX
  const txResources = simulation_resp.transactionData.build().resources();
  console.log("🚀 « txResources:", txResources);
  simulation_resp.minResourceFee = (
    Number(simulation_resp.minResourceFee) + 10000000
  ).toString();
  const sim_tx_data = simulation_resp.transactionData
    .setResources(
      txResources.instructions() == 0 ? 0 : txResources.instructions() + 500000,
      txResources.readBytes(),
      txResources.writeBytes()
    )
    .build();
  console.log("🚀 « sim_tx_data:", sim_tx_data);
  const assemble_tx = SorobanRpc.assembleTransaction(tx, simulation_resp);
  console.log("🚀 « assemble_tx:", assemble_tx);

  console.log("🚀 « sim_tx_data:", sim_tx_data);
  let prepped_tx = assemble_tx.setSorobanData(sim_tx_data).build();
  prepped_tx = new Transaction(
    await sign(prepped_tx.toXDR(), sorobanContext),
    sorobanContext.activeChain?.networkPassphrase!
  );
  console.log("🚀 « prepped_tx:", prepped_tx);

  const tx_hash = prepped_tx.hash().toString("hex");

  console.log("submitting tx...");
  let response = await server.sendTransaction(prepped_tx);
  let newResponse;
  let status: string = response.status;
  console.log(`Hash: ${tx_hash}`);
  // Poll this until the status is not "NOT_FOUND"
  while (status === "PENDING") {
    // See if the transaction is complete
    await new Promise((resolve) => setTimeout(resolve, 4000));
    console.log("checking tx...");
    newResponse = await server.getTransaction(tx_hash);
    status = newResponse.status;
  }
  return newResponse;
}

export const bumpContractInstance = async (
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
  const bumpTransactionData = new xdr.SorobanTransactionData({
    resources: new xdr.SorobanResources({
      footprint: new xdr.LedgerFootprint({
        readOnly: [contractInstanceXDR],
        readWrite: [],
      }),
      instructions: 0,
      readBytes: 0,
      writeBytes: 0,
    }),
    resourceFee: xdr.Int64.fromString("0"),
    // @ts-ignore
    ext: new xdr.ExtensionPoint(0),
  });

  const txBuilder = await createTxBuilder(sorobanContext);
  txBuilder.addOperation(
    Operation.extendFootprintTtl({ extendTo: 3110400 - 1 })
  ); // 1 year
  txBuilder.setSorobanData(bumpTransactionData);
  const result = await invokeTransaction(
    txBuilder.build(),
    false,
    sorobanContext
  );
  // @ts-ignore
  console.log(result.status, "\n");
  return result;
};

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
  public simulationResp: SorobanRpc.Api.SimulateTransactionResponse;

  constructor(
    message: string,
    simulationResp: SorobanRpc.Api.SimulateTransactionResponse
  ) {
    super(message);
    this.name = "DetailedSimulationError";
    this.simulationResp = simulationResp;
    Object.setPrototypeOf(this, DetailedSimulationError.prototype);
  }
}

async function sign(
  xdr: string,
  sorobanContext: SorobanContextType
): Promise<string> {
  const { address } = sorobanContext;
  if (sorobanContext && address) {
    // setTxStatus(TxStatus.SIGNING);
    try {
      const signed_tx = await sorobanContext.activeConnector?.signTransaction(
        xdr,
        {
          networkPassphrase: sorobanContext.activeChain?.networkPassphrase,
          network: sorobanContext.activeChain?.id,
          accountToSign: address,
        }
      );
      if (!signed_tx) throw new Error("signing error");
      return signed_tx;
    } catch (e: any) {
      if (e === "User declined access") {
        console.log("🚀 « e:", e);
        // setTxFailure("Transaction rejected by wallet.");
      } else if (typeof e === "string") {
        console.log("🚀 « e:", e);
        // setTxFailure(e);
      }

      // setTxStatus(TxStatus.FAIL);
      throw e;
    }
  } else {
    throw new Error("Not connected to a wallet");
  }
}