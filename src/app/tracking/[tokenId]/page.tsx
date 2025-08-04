// src/app/tracking/[tokenId]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useWeb3 } from '@/components/Web3Context';
import { getShipmentCollectionContract } from '@/lib/contracts';
import { supabase } from '@/lib/supabaseClient';
import { ethers } from 'ethers';
import { ShipmentContract, ShipmentDetailsStruct } from '@/types/contracts';

// --- Interfaces ---
interface Node {
  id: string;
  name: string;
  hedera_address: string;
}

interface ShipmentDisplayData {
  owner: string;
  details: ShipmentDetailsStruct;
  mappedRoute: string[];
}

// --- UI Constants ---
const statusInfo = [
  { name: "Created", color: "text-blue-600" },
  { name: "In Transit", color: "text-orange-600" },
  { name: "Awaiting Verification", color: "text-yellow-600" },
  { name: "Delivered", color: "text-green-600" },
  { name: "Completed", color: "text-gray-500" },
  { name: "Disputed", color: "text-red-600" },
  { name: "Rerouting Requested", color: "text-purple-600" },
];

export default function SingleShipmentTrackingPage() {
  const params = useParams();
  const { signer, account } = useWeb3();

  // State for all our fetched and derived data
  const [shipment, setShipment] = useState<ShipmentDisplayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  
  // A single, robust useEffect to handle everything related to data fetching and subscriptions
  useEffect(() => {
    console.log('🔄 [EFFECT] useEffect triggered');
    console.log('🔄 [EFFECT] params:', params);
    console.log('🔄 [EFFECT] params.tokenId:', params.tokenId);
    console.log('🔄 [EFFECT] typeof params.tokenId:', typeof params.tokenId);
    
    const tokenIdStr = params.tokenId as string;
    console.log('🔄 [EFFECT] tokenIdStr:', tokenIdStr);
    console.log('🔄 [EFFECT] typeof tokenIdStr:', typeof tokenIdStr);
    
    // Guard Clause 1: Exit if the URL parameter isn't ready yet.
    if (!tokenIdStr) {
      console.log('⚠️ [EFFECT] No tokenIdStr, keeping loading state');
      setIsLoading(true);
      return;
    }
    
    const tokenId = Number(tokenIdStr);
    console.log('🔄 [EFFECT] tokenId after Number():', tokenId);
    console.log('🔄 [EFFECT] typeof tokenId:', typeof tokenId);
    console.log('🔄 [EFFECT] isNaN(tokenId):', isNaN(tokenId));
    console.log('🔄 [EFFECT] tokenId < 0:', tokenId < 0);

    // Guard Clause 2: Exit if the parameter is not a valid number.
    if (isNaN(tokenId) || tokenId < 0) {
      console.log('❌ [EFFECT] Invalid tokenId, setting error');
      setError("Invalid Shipment ID provided in the URL.");
      setIsLoading(false);
      return;
    }
    
    const contract = getShipmentCollectionContract();
    
    // Define an async function inside the effect to fetch all data
    const fetchAndSetData = async () => {
      console.log(`[EFFECT] Starting data fetch for Token ID: ${tokenId}...`);
      setIsLoading(true);
      setError(null);
      
      try {
        const [details, owner, nodesResult] = await Promise.all([
          contract.shipmentDetails(tokenId),
          contract.ownerOf(tokenId),
          supabase.from('nodes').select('id, name, hedera_address')
        ]);
        
        const { data: allNodes, error: nodesError } = nodesResult;
        if (nodesError) throw nodesError;

        const routeAddresses = Array.isArray(details.plannedRoute) ? details.plannedRoute : [];
        const mappedRoute = routeAddresses.map((addr: string) => {
            const node = (allNodes || []).find(n => n.hedera_address.toLowerCase() === addr.toLowerCase());
            return node ? node.name : addr.substring(0, 6) + '...';
        });

        setShipment({ details, owner, mappedRoute });
        console.log(`[EFFECT] ✅ Successfully fetched data for Token ID: ${tokenId}`);

      } catch (err: unknown) {
        console.error('🔴 [EFFECT] Failed to fetch shipment details:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch details. The shipment ID may not exist.');
        setShipment(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAndSetData();

    // Setup the Event Listener with proper validation
    let listener: ethers.Listener | undefined;
    
    console.log('🎯 [EFFECT] About to set up event listener');
    console.log('🎯 [EFFECT] tokenId for event listener:', tokenId);
    console.log('🎯 [EFFECT] typeof tokenId:', typeof tokenId);
    console.log('🎯 [EFFECT] isNaN(tokenId):', isNaN(tokenId));
    console.log('🎯 [EFFECT] Number.isInteger(tokenId):', Number.isInteger(tokenId));
    
    // More robust validation before setting up event listener
    if (typeof tokenId === 'number' && !isNaN(tokenId) && tokenId >= 0 && Number.isInteger(tokenId)) {
        console.log('✅ [EFFECT] All validations passed, setting up event listener');
        console.log(`🎯 [EFFECT] Setting up event listener for Token ID: ${tokenId}`);
        
        try {
          // Convert to BigInt to ensure proper type for filter
          console.log('🎯 [EFFECT] Converting to BigInt...');
          const tokenIdBigInt = BigInt(tokenId);
          console.log('🎯 [EFFECT] tokenIdBigInt:', tokenIdBigInt);
          console.log('🎯 [EFFECT] typeof tokenIdBigInt:', typeof tokenIdBigInt);
          
          console.log('🎯 [EFFECT] Creating filter...');
          const filter = contract.filters.ShipmentVerifiedAndReceived(tokenIdBigInt);
          console.log('🎯 [EFFECT] Filter created successfully:', filter);
          
          listener = (id: bigint) => {
            if (id === tokenIdBigInt) {
              console.log(`[EVENT] Received update for Token ID: ${tokenId}. Refetching...`);
              fetchAndSetData();
            }
          };
          
          console.log('🎯 [EFFECT] Setting up contract listener...');
          contract.on(filter, listener);
          console.log('✅ [EFFECT] Event listener set up successfully');
        } catch (eventError) {
          console.error(`❌ [EFFECT] Failed to set up event listener for Token ID: ${tokenId}`, eventError);
          console.error('❌ [EFFECT] Event error details:', {
            tokenId,
            tokenIdType: typeof tokenId,
            isNaN: isNaN(tokenId),
            isInteger: Number.isInteger(tokenId),
            error: eventError
          });
          // Don't fail the entire component if event listener setup fails
        }
    } else {
        console.log(`⚠️ [EFFECT] Skipping event listener setup - validation failed`);
        console.log('⚠️ [EFFECT] Validation details:', {
          tokenId,
          tokenIdType: typeof tokenId,
          isNumber: typeof tokenId === 'number',
          isNaN: isNaN(tokenId),
          isNonNegative: tokenId >= 0,
          isInteger: Number.isInteger(tokenId)
        });
    }
    
    // Cleanup function
    return () => {
      console.log('🧹 [EFFECT] Cleanup function called');
      console.log('🧹 [EFFECT] listener exists:', !!listener);
      console.log('🧹 [EFFECT] tokenId for cleanup:', tokenId);
      
      if (listener && typeof tokenId === 'number' && !isNaN(tokenId) && tokenId >= 0) {
          console.log(`🧹 [EFFECT] Cleaning up listener for Token ID: ${tokenId}`);
          try {
            const tokenIdBigInt = BigInt(tokenId);
            const filter = contract.filters.ShipmentVerifiedAndReceived(tokenIdBigInt);
            contract.off(filter, listener);
            console.log('✅ [EFFECT] Listener cleaned up successfully');
          } catch (cleanupError) {
            console.error(`❌ [EFFECT] Error during listener cleanup for Token ID: ${tokenId}`, cleanupError);
          }
      } else {
          console.log('⚠️ [EFFECT] Skipping cleanup - no valid listener or tokenId');
      }
    };
    
  }, [params.tokenId]); // The entire effect depends ONLY on the raw param string from the URL.

  // Add a separate useEffect to log params changes
  useEffect(() => {
    console.log('📊 [PARAMS] Params changed:', {
      paramsObject: params,
      tokenId: params.tokenId,
      tokenIdType: typeof params.tokenId,
      stringifiedParams: JSON.stringify(params)
    });
  }, [params]);

  
  // --- Action Handlers ---
  const handleAction = async (
    action: (contract: ShipmentContract, tokenId: number) => Promise<any>, 
    loadingMsg: string, 
    successMsg: string, 
    errorMsg: string
  ) => {
    const tokenIdStr = params.tokenId as string;
    const tokenId = Number(tokenIdStr);
    
    if (!tokenIdStr || isNaN(tokenId) || tokenId < 0) {
        setTxError("Cannot perform action: Invalid Token ID.");
        return;
    }
    if (!signer) {
        setTxError("Please connect your wallet to perform this action.");
        return;
    }
    
    setTxStatus(loadingMsg);
    setTxError(null);
    try {
      const contract = getShipmentCollectionContract(signer);
      const tx = await action(contract, tokenId);
      await tx.wait();
      setTxStatus(successMsg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : errorMsg;
      setTxError(message);
      console.error(err);
    } finally {
      setTimeout(() => setTxStatus(null), 5000);
    }
  };

  const handleInitiateHandover = () => handleAction(
    (contract, tokenId) => contract.initiateHandover(tokenId),
    'Initiating handover...', 'Handover initiated successfully!', 'Failed to initiate handover.'
  );

  const handleRequestVerification = () => handleAction(
    (contract, tokenId) => {
      const custodianProofHash = shipment!.details.keyHash; 
      return contract.requestVerification(tokenId, custodianProofHash);
    },
    'Requesting verification...', 'Verification requested! The agent is now processing.', 'Failed to request verification.'
  );

  const handleFinalizeAndPay = () => handleAction(
    (contract, tokenId) => contract.finalizeAndPay(tokenId),
    'Finalizing payment...', 'Payment finalized successfully!', 'Failed to finalize payment.'
  );

  const handleDisputeShipment = () => {
    const reason = prompt('Please enter a reason for the dispute:');
    if (!reason) return;
    handleAction(
      (contract, tokenId) => contract.disputeShipment(tokenId, reason),
      'Raising dispute...', 'Dispute raised successfully!', 'Failed to raise dispute.'
    );
  };
  
  // --- UI Logic ---
  const tokenIdStr = params.tokenId as string;
  const tokenId = tokenIdStr ? Number(tokenIdStr) : null;
  const isValidTokenId = tokenId !== null && !isNaN(tokenId) && tokenId >= 0;
  
  const isCurrentOwner = account && shipment?.owner.toLowerCase() === account.toLowerCase();
  const isPendingCustodian = account && shipment?.details.pendingCustodian.toLowerCase() === account.toLowerCase();
  const isShipper = account && shipment?.details.shipper.toLowerCase() === account.toLowerCase();
  const isRecipient = account && shipment?.details.recipient.toLowerCase() === account.toLowerCase();

  // --- Render Logic ---
  if (isLoading && !shipment) return <p className="text-center mt-8 text-gray-500">Loading shipment details...</p>;
  if (error) return <p className="text-red-500 text-center mt-8">Error: {error}</p>;
  if (!isValidTokenId) return <p className="text-red-500 text-center mt-8">Invalid shipment ID in URL</p>;
  if (!shipment && !isLoading) return <p className="text-center mt-8 text-gray-500">Shipment data not found for ID #{tokenId}.</p>;
  if (!shipment) return null; // Render nothing if shipment is null after loading

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Track Shipment #{tokenId}</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-4">Shipment Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
          <p><strong>Status:</strong> <span className={`font-bold ${statusInfo[shipment.details.status]?.color || 'text-gray-600'}`}>{statusInfo[shipment.details.status]?.name || 'Unknown'}</span></p>
          <p><strong>Cargo:</strong> {shipment.details.cargoDetails}</p>
          <p><strong>Current Custodian:</strong> <span className="font-mono text-sm break-all">{shipment.owner}</span></p>
          <p><strong>Escrow Amount:</strong> {ethers.formatEther(shipment.details.paymentAmount)} HBAR</p>
          <p><strong>Shipper:</strong> <span className="font-mono text-sm break-all">{shipment.details.shipper}</span></p>
          <p><strong>Recipient:</strong> <span className="font-mono text-sm break-all">{shipment.details.recipient}</span></p>
        </div>
      </div>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Route Progress</h2>
          <div className="flex justify-between items-start relative py-4">
              {shipment.mappedRoute.map((nodeName, index) => (
                  <React.Fragment key={index}>
                      <div className="flex flex-col items-center z-10">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm border-4 ${
                              index < Number(shipment.details.currentRouteIndex) ? 'bg-green-500 border-green-200' :
                              index === Number(shipment.details.currentRouteIndex) && shipment.details.status !== 1 ? 'bg-blue-500 border-blue-200' :
                              index === Number(shipment.details.currentRouteIndex) && shipment.details.status === 1 ? 'bg-orange-500 border-orange-200 animate-pulse' :
                              'bg-gray-400 border-gray-200'
                          }`}>
                              {index + 1}
                          </div>
                          <p className="text-center text-xs mt-2 w-24 break-words font-medium">{nodeName}</p>
                      </div>
                      {index < shipment.mappedRoute.length - 1 && (
                          <div className={`flex-1 mt-5 h-1 ${index < Number(shipment.details.currentRouteIndex) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      )}
                  </React.Fragment>
              ))}
          </div>
      </div>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-4">Available Actions</h2>
        <div className="space-y-3">
          {isCurrentOwner && shipment.details.status === 0 && (
            <button onClick={handleInitiateHandover} disabled={!signer || !!txStatus}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50">
              Initiate Handover
            </button>
          )}

          {isPendingCustodian && shipment.details.status === 2 && (
            <button onClick={handleRequestVerification} disabled={!signer || !!txStatus}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50">
              Request Verification (Simulate Scan)
            </button>
          )}

          {isShipper && shipment.details.status === 3 && (
            <button onClick={handleFinalizeAndPay} disabled={!signer || !!txStatus}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50">
              Finalize & Release Payment
            </button>
          )}

          {(isShipper || isRecipient) && ![4, 5].includes(shipment.details.status) && (
            <button onClick={handleDisputeShipment} disabled={!signer || !!txStatus}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50">
              Raise Dispute
            </button>
          )}
          
          {txStatus && <p className="mt-4 text-blue-600 text-sm text-center">{txStatus}</p>}
          {txError && <p className="mt-4 text-red-600 text-sm text-center">{txError}</p>}
        </div>
      </div>
    </div>
  );
}