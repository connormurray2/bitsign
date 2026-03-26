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

/**
 * Canonical commitment: SHA-256(JSON({firstName, lastName, signatureHash[, initialsHash]}))
 * Omits initialsHash from JSON if not provided, preserving backward compatibility.
 */
export async function buildCommitmentHash(
  firstName: string,
  lastName: string,
  signatureHash: string,
  initialsHash?: string
): Promise<string> {
  const payload: Record<string, string> = { firstName, lastName, signatureHash }
  if (initialsHash) payload.initialsHash = initialsHash
  const encoded = new TextEncoder().encode(JSON.stringify(payload))
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Broadcast a bitsign-identity PUSH DROP to BSV.
 *
 * On-chain field layout:
 *   [0] "bitsign-identity"          — protocol marker
 *   [1] commitmentHash (32 bytes)   — SHA-256 of {firstName, lastName, sigHash[, initHash]}
 *   [2] ISO timestamp
 *   [3] ECDSA sig over commitmentHash — auto-added by PushDrop.lock()
 *   owner key = wallet-derived pubkey (IDENTITY_PROTOCOL, keyID=commitmentHash)
 */
export async function broadcastIdentityRegistration(
  firstName: string,
  lastName: string,
  signatureHash: string,
  initialsHash?: string
): Promise<{ txid: string; commitmentHash: string; ownerPubkey: string; rawTxHex?: string }> {
  const wallet = getWalletClient()
  const timestamp = new Date().toISOString()
  const commitmentHash = await buildCommitmentHash(firstName, lastName, signatureHash, initialsHash)

  const pd = new PushDrop(wallet as any)

  // Fields embedded in the PUSH DROP (PushDrop.lock appends an ECDSA sig as field[3])
  const fields: number[][] = [
    toBytes('bitsign-identity'),
    fromHex(commitmentHash),        // 32-byte commitment
    toBytes(timestamp),
  ]

  // PushDrop.lock():
  //   1. Derives owner pubkey via wallet.getPublicKey(IDENTITY_PROTOCOL, commitmentHash, 'self')
  //   2. Signs concat(fields) via wallet.createSignature — appends as field[3]
  //   3. Builds: <ownerPubkey> OP_CHECKSIG <field0> ... <field3> OP_2DROP OP_2DROP
  const lockingScript = await pd.lock(
    fields,
    IDENTITY_PROTOCOL,
    commitmentHash,   // keyID — unique per registration
    'self'
  )

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

  if (!result.txid) throw new Error('Wallet did not return a txid — transaction may be pending approval')

  let rawTxHex: string | undefined
  if (result.tx) {
    try {
      rawTxHex = Transaction.fromAtomicBEEF(result.tx as number[]).toHex()
    } catch {}
  }

  return { txid: result.txid, commitmentHash, ownerPubkey, rawTxHex }
}
