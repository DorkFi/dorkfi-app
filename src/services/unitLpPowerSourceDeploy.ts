import algosdk, { TransactionSigner, waitForConfirmation } from "algosdk";
import {
  CURATED_LIQUIDITY_POOLS,
  UNIT_LP_POWER_ADAPTERS,
  unitLpPowerCreateArgs,
} from "@/constants/unitLpPowerSource";
import {
  UNIT_LP_POWER_APPROVAL_B64,
  UNIT_LP_POWER_CLEAR_B64,
} from "@/constants/unitLpPowerSourceBytecode";
import algorandService, { AlgorandNetwork } from "@/services/algorandService";
import {
  getAlgorandNetworkFromNetworkId,
  type NetworkId,
} from "@/config";

const CREATE_METHOD = algosdk.ABIMethod.fromSignature(
  "create(uint64,address,uint64,uint64)void"
);

export type DeployedUnitLpPowerApp = {
  pairId: string;
  appId: number;
  txid: string;
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Create one UnitLpPowerSource app per UNIT pair. Caller signs with their wallet. */
export async function deployUnitLpPowerSources(params: {
  sender: string;
  signer: TransactionSigner;
  networkId: NetworkId;
}): Promise<DeployedUnitLpPowerApp[]> {
  const algorandNetwork = getAlgorandNetworkFromNetworkId(params.networkId);
  if (!algorandNetwork) {
    throw new Error("UNIT LP power sources deploy on Algorand only");
  }
  const { algod } = await algorandService.initializeClientsForTransactions(
    algorandNetwork as AlgorandNetwork
  );

  const approval = b64ToBytes(UNIT_LP_POWER_APPROVAL_B64);
  const clear = b64ToBytes(UNIT_LP_POWER_CLEAR_B64);
  const deployed: DeployedUnitLpPowerApp[] = [];

  for (const adapter of UNIT_LP_POWER_ADAPTERS) {
    const pair = CURATED_LIQUIDITY_POOLS.find((p) => p.id === adapter.pairId);
    if (!pair) throw new Error(`Missing pair ${adapter.pairId}`);
    const args = unitLpPowerCreateArgs(pair);
    const sp = await algod.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addMethodCall({
      appID: 0,
      method: CREATE_METHOD,
      methodArgs: [
        args.ntokenAppId,
        args.poolAddress,
        args.unitAssetId,
        args.validatorAppId,
      ],
      sender: params.sender,
      suggestedParams: { ...sp, flatFee: true, fee: 2000n },
      signer: params.signer,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      approvalProgram: approval,
      clearProgram: clear,
      numGlobalInts: 3,
      numGlobalByteSlices: 1,
      numLocalInts: 0,
      numLocalByteSlices: 0,
      extraPages: 0,
      note: new TextEncoder().encode(`unit-lp-power ${adapter.pairId}`),
    });
    const result = await atc.execute(algod, 4);
    const txid = result.txIDs[0];
    const info = await waitForConfirmation(algod, txid, 8);
    const appId = Number(
      (info as { "application-index"?: number; applicationIndex?: number })
        .applicationIndex ??
        (info as { "application-index"?: number })["application-index"]
    );
    if (!appId) {
      throw new Error(`Create confirmed but no app id for ${adapter.pairId}`);
    }
    deployed.push({ pairId: adapter.pairId, appId, txid });
  }

  return deployed;
}
