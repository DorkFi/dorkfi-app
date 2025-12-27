import algosdk from "algosdk";
import { CONTRACT } from "ulujs";
import { APP_SPEC as VNSPublicResolverSpec } from "@/clients/VNSPublicResolverClient";
import { namehash, stringToUint8Array } from "@/utils/namehash";

function stripTrailingZeroBytes(str: string): string {
  return str.replace(/\0+$/, ""); // Matches one or more '\0' at the end of the string and removes them
}

export class ResolverService {
  private client: algosdk.Algodv2;
  private indexerClient: algosdk.Indexer;
  private registryId: number;
  private mode: "default" | "builder";
  private contractInstance: any;
  private builder: any;

  constructor(
    network: "mainnet" | "testnet",
    address: string = "G3MSA75OZEJTCCENOJDLDJK7UD7E2K5DNC7FVHCNOV7E3I4DTXTOWDUIFQ",
    registryId: number = network === "mainnet" ? 797608 : 0 // Replace 0 with testnet ID when available
  ) {
    const baseServer =
      network === "mainnet"
        ? "https://mainnet-api.voi.nodely.dev"
        : "https://testnet-api.voi.nodely.dev";
    const indexerServer =
      network === "mainnet"
        ? "https://mainnet-idx.voi.nodely.dev"
        : "https://testnet-idx.voi.nodely.dev";
    this.client = new algosdk.Algodv2("", baseServer, "");
    this.indexerClient = new algosdk.Indexer(indexerServer);
    this.registryId = registryId;
    this.mode = "default";
    this.contractInstance = new CONTRACT(
      this.registryId,
      this.client,
      this.indexerClient,
      {
        name: "registry",
        description: "Registry contract for Voi names",
        methods: VNSPublicResolverSpec.contract.methods,
        events: [],
      },
      { addr: address, sk: new Uint8Array() }
    );
    this.builder = new CONTRACT(
      this.registryId,
      this.client,
      this.indexerClient,
      {
        name: "builder",
        description: "Builder contract for Voi names",
        methods: VNSPublicResolverSpec.contract.methods,
        events: [],
      },
      { addr: address, sk: new Uint8Array() },
      true,
      false,
      true
    );
  }

  getClient() {
    return this.client;
  }

  getIndexerClient() {
    return this.indexerClient;
  }

  getId() {
    return this.registryId;
  }

  setMode(mode: "default" | "builder") {
    this.mode = mode;
  }

  async name(node: string): Promise<string | null> {
    const nodeBytes = await namehash(node);
    const info = await this.contractInstance.name(nodeBytes);
    if (info.success) {
      return stripTrailingZeroBytes(info.returnValue);
    }
    return null;
  }

  async text(node: string, key: string): Promise<string | null> {
    const nodeBytes = await namehash(node);
    const keyBytes = stringToUint8Array(key, 22);
    const info = await this.contractInstance.text(nodeBytes, keyBytes);
    if (info.success) {
      return stripTrailingZeroBytes(info.returnValue);
    }
    return null;
  }

  async setText(node: string, key: string, value: string): Promise<any> {
    const nodeBytes = await namehash(node);
    const keyBytes = stringToUint8Array(key, 22);
    const valueBytes = stringToUint8Array(value, 256);
    this.contractInstance.setFee(2000);
    if (this.mode === "builder") {
      return await this.builder.setText(nodeBytes, keyBytes, valueBytes);
    }
    return await this.contractInstance.setText(nodeBytes, keyBytes, valueBytes);
  }
}

