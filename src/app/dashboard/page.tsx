// src/app/dashboard/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '@/components/Web3Context';
import { getShipmentFactoryContract } from '@/lib/contracts';
import { supabase } from '@/lib/supabaseClient';

// A TypeScript interface for the data we expect from our 'nodes' table
interface DbNode {
  id: string;
  name: string;
  hedera_address: string;
  node_type: 'warehouse' | 'port' | 'airport' | 'distribution_center' | 'retailer';
}

export default function DashboardPage() {
  const { signer, account } = useWeb3();
  
  // State for data fetched from Supabase
  const [originNodes, setOriginNodes] = useState<DbNode[]>([]);
  const [availableDestinations, setAvailableDestinations] = useState<DbNode[]>([]);
  
  // State for the form inputs
  const [originNodeId, setOriginNodeId] = useState<string>('');
  const [destinationNodeId, setDestinationNodeId] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [cargoDetails, setCargoDetails] = useState<string>('High-Value Electronics');
  const [paymentAmount, setPaymentAmount] = useState<string>('1');

  // State for UI feedback and transaction lifecycle
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);

  // --- Data Fetching Effects ---

  // 1. Fetch all potential origin nodes on initial component load
  useEffect(() => {
    const fetchInitialNodes = async () => {
      console.log('[EFFECT] Fetching potential origin nodes...');
      setIsLoading(true);
      setLoadingMessage('Loading logistics network...');
      // An "origin" can be a warehouse, port, or airport in our model
      const { data, error: dbError } = await supabase
        .from('nodes')
        .select('*')
        .in('node_type', ['warehouse', 'port', 'airport']);
      
      if (dbError) {
        console.error('🔴 [EFFECT] Error fetching origin nodes:', dbError);
        setError('Could not load logistics network data from Supabase.');
      } else {
        console.log('✅ [EFFECT] Origin nodes fetched:', data);
        setOriginNodes(data as DbNode[]);
        if (data && data.length > 0) {
          // Set a default origin to trigger the destination fetch
          setOriginNodeId(data[0].id);
        }
      }
      setIsLoading(false);
      setLoadingMessage('');
    };
    fetchInitialNodes();
  }, []);

  // 2. Fetch available destinations WHENEVER the selected origin changes
  useEffect(() => {
    if (!originNodeId) return;

    const fetchDestinations = async () => {
      console.log(`[EFFECT] Origin changed to ${originNodeId}. Fetching available destinations...`);
      setIsLoading(true);
      setLoadingMessage('Finding valid routes...');
      setAvailableDestinations([]); // Clear old destinations
      setDestinationNodeId(''); // Reset destination selection
      
      try {
        const response = await fetch(`/api/destinations?originNodeId=${originNodeId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch destination data.');
        }
        const { destinations } = await response.json();
        console.log('✅ [EFFECT] Available destinations fetched:', destinations);
        setAvailableDestinations(destinations);
        if (destinations.length > 0) {
          setDestinationNodeId(destinations[0].id); // Set a default destination
        }
      } catch (err) {
        console.error("🔴 [EFFECT] Failed to fetch available destinations:", err);
        setError("No routes found for the selected origin.");
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
      }
    };

    fetchDestinations();
  }, [originNodeId]); // This effect re-runs every time originNodeId changes

  
  // --- Core Transaction Handler ---
 // Fixed handleCreateShipment function for Hedera's tinybar units
const handleCreateShipment = async () => {
  if (!signer || !account) return setError('Please connect your wallet first.');
  if (!originNodeId || !destinationNodeId || !recipientAddress || !cargoDetails || !paymentAmount) {
    return setError('Please fill all required fields.');
  }
  
  setIsLoading(true);
  setLoadingMessage('Preparing shipment...');
  setError(null);
  setSuccessMessage(null);
  setGeneratedSecret(null);
  let newShipmentId: number | undefined;

  try {
    // Step 1: Fetch the selected route from our API
    setLoadingMessage('Fetching optimal route...');
    const routeResponse = await fetch(`/api/routes?originNodeId=${originNodeId}&destNodeId=${destinationNodeId}`);
    if (!routeResponse.ok) throw new Error((await routeResponse.json()).error || 'Failed to fetch route.');
    const { route: pureNodeAddresses } = await routeResponse.json();
    console.log('[HANDLER] Fetched pure node route:', pureNodeAddresses);

    // Step 2: Transform route for on-chain use [shipper, ...nodes, recipient]
    const fullOnChainRoute = [ account, ...pureNodeAddresses, recipientAddress ];
    console.log('[HANDLER] Constructed on-chain route:', fullOnChainRoute);

    // Step 3: Generate the secret key and its hash
    setLoadingMessage('Generating secure key...');
    const plaintextSecret = ethers.randomBytes(32);
    const secretHash = ethers.keccak256(plaintextSecret);
    const plaintextSecretHex = ethers.hexlify(plaintextSecret);
    setGeneratedSecret(plaintextSecretHex);

    // Step 4: Execute the on-chain transaction
    setLoadingMessage('Awaiting wallet confirmation...');
    const factoryContract = getShipmentFactoryContract(signer);
    const shipmentCollectionAddress = process.env.NEXT_PUBLIC_SHIPMENT_COLLECTION_ADDRESS!;

    // FIXED: For Hedera, we need to handle units correctly
    // msg.value comes in weibar (18 decimals) but contract expects tinybar (8 decimals)
    const paymentInWei = ethers.parseEther(paymentAmount); // For msg.value (18 decimals)
    const paymentInTinybar = ethers.parseUnits(paymentAmount, 8); // For contract parameter (8 decimals)
    
    // Debug logging
    console.log(`[DEBUG] Payment amount (HBAR): ${paymentAmount}`);
    console.log(`[DEBUG] Payment in wei (msg.value): ${paymentInWei.toString()}`);
    console.log(`[DEBUG] Payment in tinybar (contract param): ${paymentInTinybar.toString()}`);

    console.log(`[HANDLER] Sending transaction with value: ${paymentInWei.toString()} wei, param: ${paymentInTinybar.toString()} tinybar`);
    
    const tx = await factoryContract.createShipment(
      shipmentCollectionAddress, 
      recipientAddress, 
      cargoDetails,
      fullOnChainRoute, 
      paymentInTinybar,  // Contract parameter in tinybar (8 decimals)
      secretHash,
      { value: paymentInWei } // Transaction value in wei (18 decimals)
    );
    
    setLoadingMessage('Creating shipment on Hedera... (waiting for confirmation)');
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction receipt not found.");
    console.log('[HANDLER] Transaction confirmed. Receipt:', receipt);
    
    // Step 5: Parse the receipt to find the new Token ID
    let createdEvent;
    for (const log of receipt.logs) {
      try {
        const parsedLog = factoryContract.interface.parseLog({ topics: Array.from(log.topics), data: log.data });
        if (parsedLog && parsedLog.name === "ShipmentCreated") {
          createdEvent = parsedLog;
          break;
        }
      } catch (error) { /* Ignore logs that don't match the factory ABI */ }
    }

    if (!createdEvent) throw new Error("Could not find ShipmentCreated event in transaction receipt.");
    
    newShipmentId = Number(createdEvent.args.tokenId);
    console.log(`[HANDLER] ✅ Shipment Token ID found: ${newShipmentId}`);

    // Step 6: Store the secret in our secure backend
    setLoadingMessage('Securing shipment key...');
    const secretApiResponse = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: newShipmentId, secret: plaintextSecretHex })
    });

    if (!secretApiResponse.ok) throw new Error((await secretApiResponse.json()).error || 'Failed to store secret key.');
    
    console.log('[HANDLER] ✅ Secret stored successfully.');
    setSuccessMessage(`Shipment #${newShipmentId} created successfully! Tx Hash: ${receipt.hash}`);

  } catch (err: unknown) {
    console.error('🔴 [HANDLER] Full shipment creation process failed:', err);
    let errorMessage = 'An unknown error occurred.';
    if (err instanceof Error) errorMessage = err.message;
    setError(errorMessage);
  } finally {
    setIsLoading(false);
    setLoadingMessage('');
  }
};

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Create New Shipment</h1>
      {!account && <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert"><p>Please connect your wallet to create a shipment.</p></div>}
      
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="originNode" className="block text-gray-700 text-sm font-bold mb-2">Origin Facility</label>
              <select id="originNode" value={originNodeId} onChange={(e) => setOriginNodeId(e.target.value)} disabled={!account || isLoading || originNodes.length === 0}
                className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-200">
                {originNodes.map(node => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="destinationNode" className="block text-gray-700 text-sm font-bold mb-2">Destination Facility</label>
              <select id="destinationNode" value={destinationNodeId} onChange={(e) => setDestinationNodeId(e.target.value)} disabled={!account || isLoading || availableDestinations.length === 0}
                className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-200">
                {availableDestinations.length > 0 ? (
                  availableDestinations.map(node => <option key={node.id} value={node.id}>{node.name}</option>)
                ) : (
                  <option>Select an origin to see destinations</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="recipientAddress" className="block text-gray-700 text-sm font-bold mb-2">Final Recipient Address</label>
            <input type="text" id="recipientAddress" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} disabled={!account || isLoading}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-200" placeholder="0x..." />
          </div>

          <div>
            <label htmlFor="cargoDetails" className="block text-gray-700 text-sm font-bold mb-2">Cargo Details</label>
            <textarea id="cargoDetails" value={cargoDetails} onChange={(e) => setCargoDetails(e.target.value)} disabled={!account || isLoading}
              rows={3} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-200" placeholder="e.g., 200 units of High-Value Electronics" />
          </div>

          <div>
            <label htmlFor="paymentAmount" className="block text-gray-700 text-sm font-bold mb-2">Escrow Amount (HBAR)</label>
            <input type="number" id="paymentAmount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} disabled={!account || isLoading}
              min="0.01" step="0.01" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-200" />
          </div>
        </div>

        <div className="mt-6">
          <button onClick={handleCreateShipment} disabled={!account || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300">
            {isLoading ? loadingMessage : 'Create Shipment & Generate Key'}
          </button>
          
          {error && <p className="text-red-600 mt-4 text-sm text-center">{error}</p>}
          {successMessage && <p className="text-green-600 mt-4 text-sm text-center">{successMessage}</p>}
          
          {generatedSecret && (
            <div className="mt-4 p-4 bg-gray-100 border rounded-md">
              <p className="font-bold text-gray-800">Your Physical Package Secret Key:</p>
              <p className="break-all text-sm text-red-600 font-mono mt-2">{generatedSecret}</p>
              <p className="text-xs text-gray-600 mt-2">
                This secret is for the physical QR code on your package. It has been securely stored for agent verification.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}