// src/components/NavBar.tsx
'use client';

import Link from 'next/link';
import { useWeb3 } from '@/components/Web3Context';

export function NavBar() {
  const { account, connectWallet, disconnectWallet, isLoading, error } = useWeb3();

  return (
    <nav className="bg-gray-800 p-4 text-white">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          HBARgo
        </Link>
        <div className="flex space-x-4 items-center">
          <Link href="/dashboard" className="hover:text-gray-300">
            Create Shipment
          </Link>
          <Link href="/tracking" className="hover:text-gray-300">
            Track Shipments
          </Link>
          {account ? (
            <div className="flex items-center space-x-2">
              <span className="text-sm">
                {account.substring(0, 6)}...{account.substring(account.length - 4)}
              </span>
              <button
                onClick={disconnectWallet}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
                disabled={isLoading}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
              disabled={isLoading}
            >
              {isLoading ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </div>
    </nav>
  );
}