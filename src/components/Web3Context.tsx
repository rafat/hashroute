// src/components/Web3Context.tsx
'use client'; // This is a client component

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode, 
  useCallback 
} from 'react';
import { ethers, BrowserProvider, JsonRpcSigner } from 'ethers';

interface Web3ContextType {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  account: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isLoading: boolean;
  error: string | null;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export const Web3Provider = ({ children }: { children: ReactNode }) => {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (typeof window.ethereum !== 'undefined') {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(browserProvider);

        // Request account access
        const accounts: string[] = await browserProvider.send("eth_requestAccounts", []);
        if (accounts.length === 0) {
          throw new Error('No accounts found. Please ensure your wallet has accounts.');
        }
        setAccount(accounts[0]);
        setSigner(await browserProvider.getSigner());

        // Listen for account changes
        window.ethereum.on('accountsChanged', (newAccounts: string[]) => {
          if (newAccounts.length > 0) {
            setAccount(newAccounts[0]);
            browserProvider.getSigner().then(setSigner); // Update signer too
          } else {
            // Disconnect if no accounts are available
            disconnectWallet();
          }
        });

        // Listen for chain changes
        window.ethereum.on('chainChanged', (chainId: string) => {
          // You might want to reload the page or show a warning if the chain changes
          console.log('Chain changed to:', chainId);
          // For now, re-connect to update provider/signer
          connectWallet(); 
        });

      } else {
        setError('MetaMask or other EVM wallet not detected.');
      }
    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      setError(err.message || 'Failed to connect wallet');
      setAccount(null);
      setSigner(null);
      setProvider(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setSigner(null);
    setProvider(null);
    setError(null);
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.removeListener('accountsChanged', () => {}); // Clean up listener
      window.ethereum.removeListener('chainChanged', () => {}); // Clean up listener
    }
    console.log('Wallet disconnected.');
  }, []);

  // Auto-connect on load if already connected
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined' && window.ethereum.selectedAddress) {
      connectWallet();
    }
  }, [connectWallet]);

  const value = {
    provider,
    signer,
    account,
    connectWallet,
    disconnectWallet,
    isLoading,
    error,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};