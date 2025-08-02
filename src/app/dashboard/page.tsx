// src/app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '@/components/Web3Context';
import { getShipmentFactoryContract } from '@/lib/contracts';
import { supabase } from '@/lib/supabaseClient'; // Assuming you set this up

// Interface for Supabase nodes
interface Node {
  id: string;
  name: string;
  hedera_address: string;
  node_type: string;
}

export default function DashboardPage() {
  const { signer, account, isLoading: web3Loading, error: web3Error } = useWeb3();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [originNodeId, setOriginNodeId] = useState<string>('');
  const [destinationNodeId, setDestinationNodeId] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [cargoDetails, setCargoDetails] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('10'); // In HBAR

  const [isTxLoading, setIsTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);

  useEffect(() => {
    const fetchNodes = async () => {
      const { data, error } = await supabase
        .from('nodes')
        .select('id, name, hedera_address, node_type');
      
      if (error) {
        console.error('Error fetching nodes:', error);
        return;
      }
      setNodes(data || []);
      // Set default selected nodes if any exist
      if (data && data.length > 0) {
        setOriginNodeId(data[0].id);
        if (data.length > 1) {
          setDestinationNodeId(data[data.length - 1].id);
        }
      }
    };
    fetchNodes();
  }, []);

  const handleCreateShipment = async () => {
    if (!signer || !account) {
      setTxError('Please connect your wallet first.');
      return;
    }
    if (!originNodeId || !destinationNodeId || !recipientAddress || !cargoDetails || !paymentAmount) {
      setTxError('Please fill all required fields.');
      return;
    }

    setIsTxLoading(true);
    setTxError(null);
    setTxSuccess(null);
    setGeneratedSecret(null);

    try {
      // 1. Get node addresses from selected IDs
      const originNode = nodes.find(n => n.id === originNodeId);
      const destinationNode = nodes.find(n => n.id === destinationNodeId);

      if (!originNode || !destinationNode) {
        throw new Error('Selected origin or destination node not found in database.');
      }

      // 2. Fetch the optimal pure node route from your API
      // This API call assumes your backend maps node IDs to Hedera addresses.
      const routeResponse = await fetch(`/api/routes?originNodeId=${originNodeId}&destNodeId=${destinationNodeId}`);
      const { route: pureNodeAddresses } = await routeResponse.json();

      if (!pureNodeAddresses || pureNodeAddresses.length === 0) {
        throw new Error('No route found for selected origin and destination.');
      }

      // 3. Construct the full on-chain route: [shipper, node_1, ..., node_N, recipient]
      const fullOnChainRoute = [
        account, // Shipper's address (connected wallet)
        ...pureNodeAddresses, // Array of node Hedera addresses
        recipientAddress // Final recipient's address
      ];

      // 4. Generate Secret and Hash (Hybrid Verification Model)
      const plaintextSecret = ethers.toUtf8Bytes(ethers.randomBytes(16).toString()); // Generate a random string, then convert to bytes
      const secretHash = ethers.keccak256(plaintextSecret);
      setGeneratedSecret(ethers.hexlify(plaintextSecret)); // Display to user for QR code

      // 5. Call your backend API to store the plaintext secret (Simulated for now)
      // In a real app: await fetch('/api/secrets/store', { method: 'POST', body: JSON.stringify({ tokenId: nextTokenId, secret: ethers.utils.hexlify(plaintextSecret) }) });
      console.log("Simulating storage of plaintext secret:", ethers.hexlify(plaintextSecret));
      
      // 6. Get contract instances
      const factoryContract = getShipmentFactoryContract(signer);
      const shipmentCollectionAddress = process.env.NEXT_PUBLIC_SHIPMENT_COLLECTION_ADDRESS!; // Your deployed Shipment.sol address

      // 7. Execute the transaction
      const tx = await factoryContract.createShipment(
        shipmentCollectionAddress,
        recipientAddress,
        cargoDetails,
        fullOnChainRoute,
        ethers.parseEther(paymentAmount),
        secretHash,
        { value: ethers.parseEther(paymentAmount) }
      );

      console.log('Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('Shipment created successfully! Receipt:', receipt);

      // The tokenId is typically returned in an event. You'd parse the receipt.
      // For simplicity, let's assume it's the next nonce.
      // A more robust way is to listen for the ShipmentCreated event emitted by the factory.
      const newShipmentId = Number(await factoryContract.shipmentNonce(shipmentCollectionAddress)) -1; // Assuming nonce increments after use
      setTxSuccess(`Shipment created with ID: ${newShipmentId}! Tx Hash: ${receipt?.hash}`);

    } catch (err: any) {
      console.error('Failed to create shipment:', err);
      setTxError(err.message || 'An unknown error occurred.');
    } finally {
      setIsTxLoading(false);
    }
  };

  const currentOriginNode = nodes.find(n => n.id === originNodeId);
  const currentDestinationNode = nodes.find(n => n.id === destinationNodeId);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Create New Shipment</h1>
      {!account && <p className="text-red-500 mb-4">Please connect your wallet to create a shipment.</p>}
      
      {web3Error && <p className="text-red-500 mb-4">{web3Error}</p>}

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-4">
          <label htmlFor="originNode" className="block text-gray-700 text-sm font-bold mb-2">Origin Node:</label>
          <select
            id="originNode"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={originNodeId}
            onChange={(e) => setOriginNodeId(e.target.value)}
            disabled={!account || web3Loading || isTxLoading}
          >
            {nodes.filter(n => n.node_type === 'warehouse' || n.node_type === 'port').map(node => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="destinationNode" className="block text-gray-700 text-sm font-bold mb-2">Destination Node:</label>
          <select
            id="destinationNode"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={destinationNodeId}
            onChange={(e) => setDestinationNodeId(e.target.value)}
            disabled={!account || web3Loading || isTxLoading}
          >
            {nodes.filter(n => n.node_type === 'distribution_center' || n.node_type === 'retailer').map(node => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="recipientAddress" className="block text-gray-700 text-sm font-bold mb-2">Recipient Wallet Address:</label>
          <input
            type="text"
            id="recipientAddress"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0x..."
            disabled={!account || isTxLoading}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="cargoDetails" className="block text-gray-700 text-sm font-bold mb-2">Cargo Details:</label>
          <textarea
            id="cargoDetails"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={cargoDetails}
            onChange={(e) => setCargoDetails(e.target.value)}
            rows={3}
            placeholder="e.g., 200 units of High-Value Electronics"
            disabled={!account || isTxLoading}
          ></textarea>
        </div>

        <div className="mb-6">
          <label htmlFor="paymentAmount" className="block text-gray-700 text-sm font-bold mb-2">Payment Amount (HBAR):</label>
          <input
            type="number"
            id="paymentAmount"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            min="0.01"
            step="0.01"
            disabled={!account || isTxLoading}
          />
        </div>

        <button
          onClick={handleCreateShipment}
          className={`bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${(!account || isTxLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!account || isTxLoading}
        >
          {isTxLoading ? 'Creating Shipment...' : 'Create Shipment'}
        </button>

        {txError && <p className="text-red-500 mt-4">{txError}</p>}
        {txSuccess && <p className="text-green-500 mt-4">{txSuccess}</p>}
        {generatedSecret && (
          <div className="mt-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
            <p className="font-bold">Generated Secret Key:</p>
            <p className="break-all text-sm">{generatedSecret}</p>
            <p className="text-xs mt-2">
              (This is the key to attach to your physical package. For a real app, this would be a QR code.)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}