// src/lib/keyStore.ts
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Use the service role key for secure, server-side access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = Buffer.from(process.env.MASTER_ENCRYPTION_KEY!, 'hex');

/**
 * Encrypts a plaintext secret and stores it in the database.
 * @param tokenId - The token ID of the shipment.
 * @param plaintextSecret - The plaintext secret as a Buffer.
 */
export async function storeSecret(tokenId: number, plaintextSecret: Buffer): Promise<void> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
  
  const ciphertext = Buffer.concat([cipher.update(plaintextSecret), cipher.final()]);
  const authTag = cipher.getAuthTag(); // GCM provides an authentication tag

  // Store IV, ciphertext, and authTag in the database
  const { error } = await supabaseAdmin
    .from('encrypted_secrets')
    .insert({
      token_id: tokenId,
      // ==========================================================
      // THE FIX IS HERE: We now correctly save the IV.
      // ==========================================================
      iv: iv.toString('hex'), 
      ciphertext: Buffer.concat([ciphertext, authTag]).toString('hex'),
    });

  if (error) {
    console.error('Supabase error storing secret:', error);
    throw new Error(`Failed to store secret for token ID ${tokenId}`);
  }
}

/**
 * Retrieves and decrypts a secret from the database.
 * This would be used by your off-chain Fraud Detection Agent.
 * @param tokenId - The token ID of the shipment.
 * @returns The decrypted plaintext secret as a Buffer, or null if not found.
 */
export async function retrieveSecret(tokenId: number): Promise<Buffer | null> {
  const { data, error } = await supabaseAdmin
    .from('encrypted_secrets')
    .select('iv, ciphertext')
    .eq('token_id', tokenId)
    .single();

  if (error || !data) {
    console.error('Supabase error retrieving secret:', error);
    return null;
  }
  
  const iv = Buffer.from(data.iv, 'hex');
  const encryptedData = Buffer.from(data.ciphertext, 'hex');

  // Separate the authTag from the ciphertext (it's the last 16 bytes for AES-GCM)
  const authTag = encryptedData.subarray(-16);
  const ciphertext = encryptedData.subarray(0, -16);

  const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);
  decipher.setAuthTag(authTag);
  
  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext;
  } catch (err) {
    console.error('Decryption failed:', err);
    return null; // Decryption can fail if the key or IV is wrong, or data is corrupt
  }
}

/**
 * Deletes a secret from the database after it's no longer needed.
 * @param tokenId - The token ID of the shipment.
 */
export async function deleteSecret(tokenId: number): Promise<void> {
    await supabaseAdmin.from('encrypted_secrets').delete().eq('token_id', tokenId);
}