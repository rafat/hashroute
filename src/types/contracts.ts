import { ethers, BaseContract } from 'ethers';


export type ShipmentDetailsStruct = {
  shipper: string;
  recipient: string;
  status: number;
  cargoDetails: string;
  paymentAmount: bigint;
  plannedRoute: string[];
  currentRouteIndex: bigint;
  pendingCustodian: string;
  keyHash: string; // bytes32 is represented as a hex string
};

export interface ShipmentContract extends BaseContract {
  // --- View Functions & Public Variables ---
  shipmentDetails(tokenId: number | bigint): Promise<ShipmentDetailsStruct>;
  ownerOf(tokenId: number | bigint): Promise<string>;
  factoryAddress(): Promise<string>;

  // --- State-Changing Functions (they all return a TransactionResponse) ---
  initiateHandover(tokenId: number | bigint): Promise<ethers.TransactionResponse>;
  requestVerification(tokenId: number | bigint, custodianProofHash: string): Promise<ethers.TransactionResponse>;
  finalizeAndPay(tokenId: number | bigint): Promise<ethers.TransactionResponse>;
  disputeShipment(tokenId: number | bigint, reason: string): Promise<ethers.TransactionResponse>;
  
}


// You can do the same for your other contracts
export interface ShipmentFactoryContract extends BaseContract {
    isShipmentContractRegistered(address: string): Promise<boolean>;
    shipmentNonce(address: string): Promise<bigint>;
    createShipment(
        collectionAddress: string,
        recipient: string,
        cargoDetails: string,
        plannedRoute: string[],
        paymentAmount: bigint,
        keyHash: string,
        overrides: { value: bigint }
    ): Promise<ethers.TransactionResponse>;
}

export interface OracleRegistryContract extends BaseContract {
  registerOracle(oracleAddress: string): Promise<ethers.TransactionResponse>;
  unregisterOracle(oracleAddress: string): Promise<ethers.TransactionResponse>;
  isOracleRegistered(oracleAddress: string): Promise<boolean>;
  getRegisteredOracles(): Promise<string[]>;
}