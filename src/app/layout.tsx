// src/app/layout.tsx
import './globals.css';
import { Inter } from 'next/font/google';
import { Web3Provider } from '@/components/Web3Context'; // Import the provider
import { NavBar } from '@/components/NavBar';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Web3Provider>
           <NavBar />
          <main className="container mx-auto p-4">{children}</main>
        </Web3Provider>
      </body>
    </html>
  );
}