'use client';

import { useWeb3 } from '@/components/Web3Context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function InitiateHandoverPage() {
  const { account } = useWeb3();
  const router = useRouter();

  useEffect(() => {
    // This page is mostly a redirect or a simple form
    // In a real app, you'd fetch shipments owned by 'account' here
    // and provide links to initiate handover for them.
    if (!account) {
      router.push('/'); // Redirect to home if not connected
    }
  }, [account, router]);

  if (!account) {
    return <p className="text-center mt-8">Please connect your wallet.</p>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Initiate Handover</h1>
      <p className="mb-4">This page would list shipments you currently own and allow you to initiate their handover.</p>
      <p className="text-gray-600">
        For a demo, you can navigate directly to a specific shipment's tracking page (e.g., <Link href="/tracking/0" className="text-blue-500 underline">/tracking/0</Link>)
        and perform the action there if your connected wallet is the current owner.
      </p>
    </div>
  );
}