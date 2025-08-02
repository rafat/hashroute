// src/lib/contracts/index.ts
import { ethers, Signer } from 'ethers';
import {OracleRegistryABI, ShipmentABI, ShipmentFactoryABI} from './abis';
import { OracleRegistryContract, ShipmentContract, ShipmentFactoryContract } from '../../types/contracts';

// Contract Addresses (from .env.local)
const ORACLE_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_REGISTRY_ADDRESS!;
const SHIPMENT_FACTORY_ADDRESS = process.env.NEXT_PUBLIC_SHIPMENT_FACTORY_ADDRESS!;
const SHIPMENT_COLLECTION_ADDRESS = process.env.NEXT_PUBLIC_SHIPMENT_COLLECTION_ADDRESS!;

// Ensure window.ethereum is available for BrowserProvider
const getProvider = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }
  // Fallback for server-side rendering or non-EVM environment (read-only)
  return new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet.hashio.io/api'); // You might need a public RPC URL here
};

export const getOracleRegistryContract = (signer?: Signer) => {
  const provider = getProvider();
  const contract = new ethers.Contract(ORACLE_REGISTRY_ADDRESS, OracleRegistryABI, provider);
  const connectedContract = signer ? contract.connect(signer) : contract;
  // Cast the generic contract to our specific, manually-typed interface
  return connectedContract as unknown as OracleRegistryContract;
};

export const getShipmentFactoryContract = (signer?: Signer) => {
  const provider = getProvider();
  const contract = new ethers.Contract(SHIPMENT_FACTORY_ADDRESS, ShipmentFactoryABI, provider);
  const connectedContract = signer ? contract.connect(signer) : contract;
  // Cast the generic contract to our specific, manually-typed interface
  return connectedContract as unknown as ShipmentFactoryContract;

};

export const getShipmentCollectionContract = (signer?: Signer) => {
  const provider = getProvider();
  const contract = new ethers.Contract(SHIPMENT_COLLECTION_ADDRESS, ShipmentABI, provider);
  const connectedContract = signer ? contract.connect(signer) : contract;
  // Cast the generic contract to our specific, manually-typed interface
  return connectedContract as unknown as ShipmentContract;
};