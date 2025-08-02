'use client'; // This component uses client-side hooks like Link

import Link from 'next/link';
import { useWeb3 } from './Web3Context'; // Assuming this is your Web3 context hook

// Simple placeholder icons. You can replace these with better SVG icons from a library like Heroicons.
const IconBlockchain = () => (
  <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
);
const IconShield = () => (
  <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 20.944a12.02 12.02 0 009 2.944a12.02 12.02 0 009-2.944a12.02 12.02 0 00-2.382-8.944z" /></svg>
);
const IconRoute = () => (
  <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
);

export function HomePage() {
  const { account } = useWeb3();

  return (
    <div className="bg-gray-50 text-gray-800">
      {/* Hero Section */}
      <section className="bg-slate-900 text-white text-center py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
            HBARgo: Logistics, Reimagined on Hedera
          </h1>
          <p className="mt-4 text-lg md:text-xl text-slate-300 max-w-3xl mx-auto">
            Experience the future of supply chains with autonomous agents, on-chain verification, and trustless payments. Real-time tracking with unparalleled security.
          </p>
          <div className="mt-8">
            <Link href={account ? "/dashboard" : "/tracking"} legacyBehavior>
              <a className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg py-3 px-8 rounded-full transition duration-300">
                {account ? 'Create a Shipment' : 'Track a Shipment'}
              </a>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-2">Why HBARgo?</h2>
          <p className="text-gray-600 mb-12">The power of Hedera's hashgraph, applied to real-world logistics.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-md">
              <IconBlockchain />
              <h3 className="text-xl font-bold mt-4 mb-2">On-Chain Provenance</h3>
              <p className="text-gray-600">
                Every shipment is a unique NFT on Hedera, creating an immutable, auditable history of its journey from origin to destination.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-md">
              <IconShield />
              <h3 className="text-xl font-bold mt-4 mb-2">Autonomous Verification</h3>
              <p className="text-gray-600">
                Our off-chain fraud detection agent performs multi-factor checks at every handover, preventing fraud before it happens.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-md">
              <IconRoute />
              <h3 className="text-xl font-bold mt-4 mb-2">Intelligent Rerouting</h3>
              <p className="text-gray-600">
                When disruptions occur, our routing agent analyzes real-time data to find the new optimal path and executes the change on-chain.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">Simple Steps, Powerful Results</h2>
          <div className="relative">
            {/* The connecting line */}
            <div className="absolute left-1/2 top-10 bottom-10 w-0.5 bg-gray-200 hidden md:block" />
            
            <div className="space-y-12">
              {/* Step 1 */}
              <div className="flex flex-col md:flex-row items-center">
                <div className="md:w-1/2 md:pr-8 text-center md:text-right">
                  <h3 className="text-2xl font-bold text-blue-600">1. Create & Secure</h3>
                  <p className="text-gray-600 mt-2">
                    Initiate a shipment, funding the on-chain escrow. A unique secret key is generated for the physical package, and its hash is stored immutably on the NFT.
                  </p>
                </div>
                <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold z-10 my-4 md:my-0">1</div>
                <div className="md:w-1/2 md:pl-8" />
              </div>

              {/* Step 2 */}
              <div className="flex flex-col md:flex-row items-center">
                <div className="md:w-1/2 md:pr-8 order-2 md:order-1" />
                <div className="w-16 h-16 bg-green-600 text-white rounded-full flex items-center justify-center text-2xl font-bold z-10 my-4 md:my-0 order-1 md:order-2">2</div>
                <div className="md:w-1/2 md:pl-8 text-center md:text-left order-3">
                  <h3 className="text-2xl font-bold text-green-600">2. Track & Verify</h3>
                  <p className="text-gray-600 mt-2">
                    At each handover point, the custodian scans the package. Our agent verifies the proof off-chain before confirming the custody change on-chain.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col md:flex-row items-center">
                <div className="md:w-1/2 md:pr-8 text-center md:text-right">
                  <h3 className="text-2xl font-bold text-purple-600">3. Deliver & Pay</h3>
                  <p className="text-gray-600 mt-2">
                    Upon successful final delivery, the shipper can trigger the `finalizeAndPay` function. The smart contract autonomously releases the escrowed HBAR payment.
                  </p>
                </div>
                <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold z-10 my-4 md:my-0">3</div>
                <div className="md:w-1/2 md:pl-8" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-slate-800 text-white py-16 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold">Ready to Join the Future of Logistics?</h2>
          <p className="mt-4 text-slate-300 max-w-2xl mx-auto">
            Connect your wallet and start creating verifiable, autonomous shipments on the Hedera network today.
          </p>
          <div className="mt-8">
            <Link href="/dashboard" legacyBehavior>
              <a className="bg-white hover:bg-gray-200 text-slate-800 font-bold text-lg py-3 px-8 rounded-full transition duration-300">
                Get Started
              </a>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}