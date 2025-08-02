// src/app/api/secrets/route.ts
import { NextResponse } from 'next/server';
import { storeSecret } from '@/lib/keyStore'; // Import our secure service

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tokenId, secret } = body;

        if (tokenId === undefined || !secret) {
            return NextResponse.json({ error: 'tokenId and secret are required.' }, { status: 400 });
        }

        // The secret from the frontend will be a hex string, convert it to a Buffer
        const secretBuffer = Buffer.from(secret.startsWith('0x') ? secret.substring(2) : secret, 'hex');

        // Call the secure storage function
        await storeSecret(tokenId, secretBuffer);

        return NextResponse.json({ message: `Secret for token ${tokenId} stored successfully.` }, { status: 201 });

    } catch (error: unknown) {
        console.error('API Error in /api/secrets:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}