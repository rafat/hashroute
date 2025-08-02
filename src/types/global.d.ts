// src/types/globals.d.ts
interface EthereumProvider {
  isMetaMask?: boolean;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(eventName: string, callback: (...args: any[]) => void): void;
  removeListener(eventName: string, callback: (...args: any[]) => void): void;
  selectedAddress?: string;
}

interface Window {
  ethereum?: EthereumProvider;
}

