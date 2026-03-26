'use client'

import { Transaction, PushDrop } from '@bsv/sdk'
import { getWalletClient } from '../wallet/cwi'
import { fromHex } from './pushdrop'
import { IDENTITY_BASKET, IDENTITY_PROTOCOL } from '../utils/constants'

function toBytes(str: string): number[] {
  return Array.from(new TextEncoder().encode(str))
}

/** SHA-256 of a base64 PNG data URL, returns hex string */
export async function sha256DataUrl(dataUrl: string): Promise<string> {
  const base64 = dataUrl.split(',')[1]
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Canonical commitment: SHA-256(JSON({firstName, lastName, signatureHash})) */
export async function buildCommitmentHash(
  firstName: string,
  lastName: string,
  signatureHash: string
): Promise<string> {
  const data = JSON.stringify({ firstName, lastName, signatureHash })
  const encoded = new TextEncoder().encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Broadcast a bitsign-identity PUSH DROP to BSV.
 * Fields: [0]="bitsign-identity" [1]=commitmentHash(32 bytes) [2]=timestamp
 */
export async function broadcastIdentityRegistration(
  firstName: string,
  lastName: string,
  signatureHash: string
): Promise<{ txid: string; commitmentHash: string; ownerPubkey: string; rawTxHex?: string }> {
  const wallet = getWalletClient()
  const timestamp = new Date().toISOString()
  const commitmentHash = await buildCommitmentHash(firstName, lastName, signatureHash)

  const pd = new PushDrop(wallet as any)

  const fields: number[][] = [
    toBytes('bitsign-identity'),
    fromHex(commitmentHash),
    toBytes(timestamp),
  ]

  const lockingScript = await pd.lock(fields, IDENTITY_PROTOCOL, commitmentHash, 'self')

  const { publicKey: ownerPubkey } = await wallet.getPublicKey({
    protocolID: IDENTITY_PROTOCOL,
    keyID: commitmentHash,
    counterparty: 'self',
  })

  const result = await wallet.createAction({
    description: 'BitSign: Identity Registration',
    outputs: [
      {
        lockingScript: lockingScript.toHex(),
        satoshis: 1,
        outputDescription: 'BitSign identity registration',
        basket: IDENTITY_BASKET,
      },
    ],
    labels: ['bitsign', 'bitsign-identity'],
  })

  if (!result.txid) throw new Error('Wallet did not return a txid')

  let rawTxHex: string | undefined
  if (result.tx) {
    try {
      rawTxHex = Transaction.fromAtomicBEEF(result.tx as number[]).toHex()
    } catch {}
  }

  return { txid: result.txid, commitmentHash, ownerPubkey, rawTxHex }
}
