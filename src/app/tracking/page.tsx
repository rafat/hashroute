'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWeb3 } from '@/components/Web3Context';
import { getShipmentCollectionContract, getShipmentFactoryContract } from '@/lib/contracts';
import { ethers } from 'ethers';

// Interface for the summary data we'll display on each card
interface ShipmentOverview {
  tokenId: number;
  shipper: string;
  recipient: string;
  status: string;
  cargo: string;
}

// Map status enum index to a readable name
const statusNames = ["Created", "In Transit", "Awaiting Verification", "Delivered", "Completed", "Disputed"];

export default function TrackShipmentsPage() {
  const { account, provider } = useWeb3(); // We only need the provider for read-only actions
  const [myShipments, setMyShipments] = useState<ShipmentOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShipments = async () => {
      // Guard clauses: only run if the user is connected and the provider is available
      if (!provider || !account) {
        setIsLoading(false);
        return;
      }

      console.log('[TRACKING LIST] Fetching shipments for account:', account);
      setIsLoading(true);
      setError(null);
      
      try {
        // =========================================================================
        // THE FIX: Call the functions WITHOUT any arguments.
        // This will use the default provider for read-only access and return a
        // contract instance that is not connected to a signer.
        // =========================================================================
        const factoryContract = getShipmentFactoryContract();
        const collectionContract = getShipmentCollectionContract();
        
        const collectionAddress = process.env.NEXT_PUBLIC_SHIPMENT_COLLECTION_ADDRESS!;

        const currentNonce = Number(await factoryContract.shipmentNonce(collectionAddress));
        console.log(`[TRACKING LIST] Current nonce is ${currentNonce}. Checking recent tokens...`);

        const fetchedShipments: ShipmentOverview[] = [];
        const promises: Promise<void>[] = [];

        const startToken = Math.max(0, currentNonce - 10);

        for (let i = startToken; i < currentNonce; i++) {
          const tokenId = i;
          const checkTokenPromise = async () => {
            try {
              const [details, owner] = await Promise.all([
                  collectionContract.shipmentDetails(tokenId),
                  collectionContract.ownerOf(tokenId)
              ]);

              if (
                  details.shipper.toLowerCase() === account.toLowerCase() || 
                  details.recipient.toLowerCase() === account.toLowerCase() ||
                  owner.toLowerCase() === account.toLowerCase()
              ) {
                fetchedShipments.push({
                  tokenId: tokenId,
                  shipper: details.shipper,
                  recipient: details.recipient,
                  status: statusNames[Number(details.status)] || 'Unknown',
                  cargo: details.cargoDetails,
                });
              }
            } catch (itemError: unknown) {
              // It's normal for `ownerOf` to fail for non-existent tokens. We can safely ignore these errors.
            }
          };
          promises.push(checkTokenPromise());
        }

        await Promise.all(promises);
        
        fetchedShipments.sort((a, b) => b.tokenId - a.tokenId);
        
        setMyShipments(fetchedShipments);
        console.log(`[TRACKING LIST] ✅ Found ${fetchedShipments.length} relevant shipments.`);

      } catch (err: unknown) {
        console.error('🔴 [TRACKING LIST] Failed to fetch shipments:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred while fetching shipments.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchShipments();
  }, [account, provider]); // Re-run when the user connects their wallet

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Your Shipments</h1>
      
      {!account && <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert"><p>Please connect your wallet to view your shipments.</p></div>}
      
      {isLoading && <p className="text-gray-500">Loading shipments...</p>}
      
      {error && <p className="text-red-500">{error}</p>}
      
      {account && !isLoading && myShipments.length === 0 && (
        <p className="text-gray-600">No shipments found that are associated with your account.</p>
      )}

      {myShipments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myShipments.map(shipment => (
            <div key={shipment.tokenId} className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
              <div className="flex justify-between items-start">
                  <h2 className="text-xl font-semibold text-gray-800">Shipment #{shipment.tokenId}</h2>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      shipment.status === 'Delivered' || shipment.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      shipment.status === 'Disputed' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                      {shipment.status}
                  </span>
              </div>
              <p className="text-gray-600 mt-2">{shipment.cargo}</p>
              <div className="mt-4 text-sm text-gray-500">
                  <p><strong>From:</strong> <span className="font-mono">{shipment.shipper.substring(0, 6)}...{shipment.shipper.substring(shipment.shipper.length - 4)}</span></p>
                  <p><strong>To:</strong> <span className="font-mono">{shipment.recipient.substring(0, 6)}...{shipment.recipient.substring(shipment.recipient.length - 4)}</span></p>
              </div>
              <Link href={`/tracking/${shipment.tokenId}`} className="text-blue-600 hover:underline mt-4 inline-block font-semibold">
                View Details →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}