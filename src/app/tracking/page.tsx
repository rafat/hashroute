'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useWeb3 } from '@/components/Web3Context';
import { getShipmentCollectionContract } from '@/lib/contracts';
import { supabase } from '@/lib/supabaseClient';
import { ethers } from 'ethers';

// Interfaces for data
interface Node {
  id: string;
  name: string;
  hedera_address: string;
  geo_location: { x: number; y: number; }; // Supabase point type
}

interface ShipmentDetails {
  shipper: string;
  recipient: string;
  status: number; // Enum index
  cargoDetails: string;
  paymentAmount: bigint;
  plannedRoute: string[]; // Hedera addresses
  currentRouteIndex: number;
  pendingCustodian: string;
  keyHash: string; // Hex string
  owner: string; // Current NFT owner
}

// Map status enum to readable names
const statusNames = ["Created", "InTransit", "AwaitingVerification", "Delivered", "Completed", "Disputed", "ReroutingRequested"];

export default function SingleShipmentTrackingPage() {
  const params = useParams();
  const tokenId = Number(params.tokenId);
  const { signer, account } = useWeb3();

  const [shipment, setShipment] = useState<ShipmentDetails | null>(null);
  const [nodesData, setNodesData] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const fetchShipmentDetails = useCallback(async () => {
    if (!tokenId || !account) return;
    setIsLoading(true);
    setError(null);
    try {
      const contract = getShipmentCollectionContract(); // Use provider for read-only
      const details = await contract.shipmentDetails(tokenId);
      const owner = await contract.ownerOf(tokenId);

      // Fetch all nodes from Supabase once
      const { data: allNodes, error: nodesError } = await supabase.from('nodes').select('id, name, hedera_address, geo_location');
      if (nodesError) throw nodesError;
      setNodesData(allNodes || []);

      // Adjust the plannedRoute from Hedera addresses to node IDs for internal use
      // And map current owner/pending custodian back to node names
      const mappedRoute = details.plannedRoute.map((addr: string) => {
        const node = (allNodes || []).find(n => n.hedera_address.toLowerCase() === addr.toLowerCase());
        return node ? node.name : addr.substring(0,6) + '...'; // Fallback to address if not a registered node
      });

      setShipment({
        shipper: details.shipper,
        recipient: details.recipient,
        status: Number(details.status),
        cargoDetails: details.cargoDetails,
        paymentAmount: details.paymentAmount,
        plannedRoute: mappedRoute, // Now contains names
        currentRouteIndex: Number(details.currentRouteIndex),
        pendingCustodian: details.pendingCustodian,
        keyHash: details.keyHash,
        owner: owner // Current NFT owner
      });
    } catch (err: any) {
      console.error('Failed to fetch shipment details:', err);
      setError(err.message || 'Failed to fetch shipment details. Ensure ID is correct.');
      setShipment(null);
    } finally {
      setIsLoading(false);
    }
  }, [tokenId, account]);

  useEffect(() => {
    fetchShipmentDetails();
    // Potentially subscribe to contract events for real-time updates
    const contract = getShipmentCollectionContract();
    const filter = contract.filters.ShipmentVerifiedAndReceived(tokenId);
    const listener = (id: bigint, newCustodian: string) => {
      if (id === BigInt(tokenId)) {
        console.log(`Shipment ${tokenId} received by ${newCustodian}`);
        fetchShipmentDetails(); // Re-fetch on update
      }
    };
    contract.on(filter, listener);
    return () => {
      contract.off(filter, listener); // Clean up
    };
  }, [tokenId, fetchShipmentDetails]);


  const handleInitiateHandover = async () => {
    if (!signer || !shipment) return;
    setTxStatus('Initiating handover...');
    setTxError(null);
    try {
      const contract = getShipmentCollectionContract(signer);
      const tx = await contract.initiateHandover(tokenId);
      await tx.wait();
      setTxStatus('Handover initiated successfully!');
      fetchShipmentDetails(); // Re-fetch state
    } catch (err: any) {
      setTxError(err.message || 'Failed to initiate handover.');
      console.error(err);
    } finally {
      setTxStatus(null);
    }
  };

  const handleRequestVerification = async () => {
    if (!signer || !shipment) return;
    setTxStatus('Requesting verification...');
    setTxError(null);
    try {
      // For demo, we are using the stored keyHash from the shipment details.
      // In a real scenario, the custodian would scan the physical package
      // to get the plaintext key, then hash it here.
      // This is a simplification for hackathon demo.
      const custodianProofHash = shipment.keyHash; 
      
      const contract = getShipmentCollectionContract(signer);
      const tx = await contract.requestVerification(tokenId, custodianProofHash);
      await tx.wait();
      setTxStatus('Verification requested! Agent is processing...');
      fetchShipmentDetails(); // Re-fetch state
    } catch (err: any) {
      setTxError(err.message || 'Failed to request verification.');
      console.error(err);
    } finally {
      setTxStatus(null);
    }
  };

  const handleFinalizeAndPay = async () => {
    if (!signer || !shipment) return;
    setTxStatus('Finalizing payment...');
    setTxError(null);
    try {
      const contract = getShipmentCollectionContract(signer);
      const tx = await contract.finalizeAndPay(tokenId);
      await tx.wait();
      setTxStatus('Payment finalized successfully!');
      fetchShipmentDetails();
    } catch (err: any) {
      setTxError(err.message || 'Failed to finalize payment.');
      console.error(err);
    } finally {
      setTxStatus(null);
    }
  };

  const handleDisputeShipment = async () => {
    if (!signer || !shipment) return;
    const reason = prompt('Please enter a reason for the dispute:');
    if (!reason) return;

    setTxStatus('Raising dispute...');
    setTxError(null);
    try {
      const contract = getShipmentCollectionContract(signer);
      const tx = await contract.disputeShipment(tokenId, reason);
      await tx.wait();
      setTxStatus('Dispute raised successfully!');
      fetchShipmentDetails();
    } catch (err: any) {
      setTxError(err.message || 'Failed to raise dispute.');
      console.error(err);
    } finally {
      setTxStatus(null);
    }
  };

  // Helper to determine if the current user (account) is the current NFT owner
  const isCurrentOwner = account && shipment?.owner.toLowerCase() === account.toLowerCase();
  // Helper to determine if the current user is the pending custodian
  const isPendingCustodian = account && shipment?.pendingCustodian.toLowerCase() === account.toLowerCase();
  // Helper to determine if the current user is the original shipper
  const isShipper = account && shipment?.shipper.toLowerCase() === account.toLowerCase();
  // Helper to determine if the current user is the final recipient
  const isRecipient = account && shipment?.recipient.toLowerCase() === account.toLowerCase();

  // Get current node details for geo-location/display
  const currentOwnerNode = isCurrentOwner ? nodesData.find(n => n.hedera_address.toLowerCase() === shipment?.owner.toLowerCase()) : null;
  const pendingCustodianNode = isPendingCustodian ? nodesData.find(n => n.hedera_address.toLowerCase() === shipment?.pendingCustodian.toLowerCase()) : null;

  if (isLoading) return <p className="text-center mt-8">Loading shipment details...</p>;
  if (error) return <p className="text-red-500 text-center mt-8">Error: {error}</p>;
  if (!shipment) return <p className="text-center mt-8">Shipment not found.</p>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Track Shipment #{tokenId}</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Shipment Overview</h2>
        <p><strong>Status:</strong> <span className={`font-bold ${
          shipment.status === 3 ? 'text-green-600' : 
          shipment.status === 5 ? 'text-red-600' : 
          shipment.status === 2 ? 'text-orange-600' : 'text-blue-600'
        }`}>{statusNames[shipment.status]}</span></p>
        <p><strong>Cargo:</strong> {shipment.cargoDetails}</p>
        <p><strong>Shipper:</strong> {shipment.shipper.substring(0, 8)}...{shipment.shipper.substring(shipment.shipper.length - 6)}</p>
        <p><strong>Recipient:</strong> {shipment.recipient.substring(0, 8)}...{shipment.recipient.substring(shipment.recipient.length - 6)}</p>
        <p><strong>Current Owner:</strong> {shipment.owner.substring(0, 8)}...{shipment.owner.substring(shipment.owner.length - 6)} 
           {currentOwnerNode && ` (${currentOwnerNode.name})`}
        </p>
        {shipment.pendingCustodian !== ethers.ZeroAddress && (
          <p><strong>Pending Handover To:</strong> {shipment.pendingCustodian.substring(0, 8)}...{shipment.pendingCustodian.substring(shipment.pendingCustodian.length - 6)}
            {pendingCustodianNode && ` (${pendingCustodianNode.name})`}
          </p>
        )}
      </div>

      {/* Route Visualization */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Route Progress</h2>
        <div className="flex justify-between items-center relative py-4">
          {shipment.plannedRoute.map((nodeName, index) => (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                  index === 0 && shipment.status === 0 ? 'bg-blue-500' : // Shipper (start)
                  index === 0 && shipment.owner.toLowerCase() === shipment.shipper.toLowerCase() ? 'bg-blue-500' :
                  index <= shipment.currentRouteIndex && shipment.status !== 0 ? 'bg-green-500' : // Visited nodes
                  index === shipment.currentRouteIndex +1 && shipment.status === 1 ? 'bg-orange-500' : // Pending node
                  'bg-gray-400' // Future nodes
                }`}>
                  {index +1}
                </div>
                <p className="text-center text-xs mt-1 w-24 break-words">{nodeName}</p>
              </div>
              {index < shipment.plannedRoute.length - 1 && (
                <div className={`flex-1 h-1 bg-gray-300 mx-2 ${index < shipment.currentRouteIndex ? 'bg-green-500' : ''}`}></div>
              )}
            </React.Fragment>
          ))}
        </div>
        <p className="text-sm text-gray-600 mt-4">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-1"></span> Shipper/Current Step
          <span className="inline-block w-3 h-3 rounded-full bg-green-500 ml-4 mr-1"></span> Completed
          <span className="inline-block w-3 h-3 rounded-full bg-orange-500 ml-4 mr-1"></span> In Transit / Pending Next
          <span className="inline-block w-3 h-3 rounded-full bg-gray-400 ml-4 mr-1"></span> Future Step
        </p>
      </div>


      {/* Action Buttons */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Actions</h2>
        <div className="space-y-2">
          {isCurrentOwner && shipment.status === 0 && (
            <button
              onClick={handleInitiateHandover}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!signer || !!txStatus}
            >
              Initiate Handover
            </button>
          )}

          {isPendingCustodian && shipment.status === 2 && ( // AwaitingVerification
            <button
              onClick={handleRequestVerification}
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!signer || !!txStatus}
            >
              Request Verification (Scan)
            </button>
          )}

          {isShipper && shipment.status === 3 && ( // Delivered
            <button
              onClick={handleFinalizeAndPay}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!signer || !!txStatus}
            >
              Finalize & Pay
            </button>
          )}

          {(isShipper || isRecipient || isCurrentOwner) && shipment.status !== 3 && shipment.status !== 4 && (
            <button
              onClick={handleDisputeShipment}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!signer || !!txStatus}
            >
              Raise Dispute
            </button>
          )}
          {/* TODO: Add Reroute button for current node owner (isCurrentOwner && node_type matches) */}

          {txStatus && <p className="mt-4 text-blue-500">{txStatus}</p>}
          {txError && <p className="mt-4 text-red-500">{txError}</p>}
        </div>
      </div>
    </div>
  );
}