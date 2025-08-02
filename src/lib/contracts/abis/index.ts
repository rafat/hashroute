// lib/contracts/abis/index.ts
import { InterfaceAbi } from 'ethers';

import OracleRegistry from './OracleRegistry.json';
import Shipment from './Shipment.json';
import ShipmentFactory from './ShipmentFactory.json';


export const OracleRegistryABI = OracleRegistry as InterfaceAbi;
export const ShipmentABI = Shipment as InterfaceAbi;
export const ShipmentFactoryABI = ShipmentFactory as InterfaceAbi;
