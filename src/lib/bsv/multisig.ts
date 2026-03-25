'use client'

import { Transaction } from '@bsv/sdk'
import { getWalletClient } from '../wallet/cwi'
import { PushDrop } from '@bsv/sdk'
import { PUSH_DROP_BASKET } from '../utils/constants'

export const BITSIGN_MULTI_PROTOCOL_ID = 'bitsign-multi'

export interface PartialSig {
  signerId: string
  pubkey: string
  sig: string // DER hex
}

export interface MultisigBroadcastResult {
  txid: string
  outputIndex: number
  lockingScriptHex: string
  rawTxHex?: string
}

function toBytes(str: string): number[] {
  return Array.from(new TextEncoder().encode(str))
}

function fromHex(hex: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16))
  }
  return bytes
}

/**
 * Build and broadcast the final multisig PUSH DROP transaction.
 *
 * Called client-side by the last signer once all partial sigs are collected.
 * The PUSH DROP embeds all signers' pubkeys and ECDSA sigs as fields.
 *
 * Fields layout:
 *   [0]  "bitsign-multi"            (protocol identifier)
 *   [1]  docHash bytes              (raw SHA-256)
 *   [2]  timestamp UTF-8
 *   [3]  docTitle UTF-8
 *   [4]  provenance JSON UTF-8      ([{signerId, pubkey, sig}, ...])
 *   [5]  owner embedded sig         (auto-added by PushDrop.lock)
 *
 * Owner = last signer's BRC-43 derived key (protocolID + keyID = docHash)
 */
export async function buildAndBroadcastMultisigDocument(
  docHash: string,
  docTitle: string,
  partialSigs: PartialSig[]
): Promise<MultisigBroadcastResult> {
  const wallet = getWalletClient()
  const timestamp = new Date().toISOString()

  const pd = new PushDrop(wallet as any)

  const provenance = partialSigs.map((s) => ({
    signerId: s.signerId,
    pubkey: s.pubkey,
    sig: s.sig,
  }))

  const fields: number[][] = [
    toBytes(BITSIGN_MULTI_PROTOCOL_ID),
    fromHex(docHash),
    toBytes(timestamp),
    toBytes(docTitle),
    toBytes(JSON.stringify(provenance)),
  ]

  const lockingScript = await pd.lock(
    fields,
    [1, 'bitsign document signing'],
    docHash,
    'self'
  )

  const lockingScriptHex = lockingScript.toHex()

  const result = await wallet.createAction({
    description: `BitSign: ${docTitle} (${partialSigs.length} signers)`,
    outputs: [
      {
        lockingScript: lockingScriptHex,
        satoshis: 1,
        outputDescription: 'BitSign multisig signing event',
        basket: PUSH_DROP_BASKET,
      },
    ],
    labels: ['bitsign', 'bitsign-multi'],
  })

  if (!result.txid) throw new Error('Wallet did not return a txid')

  let rawTxHex: string | undefined
  if (result.tx) {
    try {
      rawTxHex = Transaction.fromAtomicBEEF(result.tx as number[]).toHex()
    } catch {
      // fall back to WoC if needed
    }
  }

  return {
    txid: result.txid,
    outputIndex: 0,
    lockingScriptHex,
    rawTxHex,
  }
}

/**
 * Sign the document hash as a partial signature (no TX broadcast).
 * Returns { sig: DER hex, pubkey: compressed hex }.
 */
export async function createPartialSig(
  docHash: string
): Promise<{ sig: string; pubkey: string }> {
  const wallet = getWalletClient()

  const [sigResult, pkResult] = await Promise.all([
    wallet.createSignature({
      data: Array.from(Buffer.from(docHash, 'hex')),
      protocolID: [1, 'bitsign document signing'],
      keyID: docHash,
      counterparty: 'self',
    }),
    wallet.getPublicKey({
      protocolID: [1, 'bitsign document signing'],
      keyID: docHash,
      counterparty: 'self',
    }),
  ])

  const sig = Buffer.from(sigResult.signature).toString('hex')
  const pubkey = pkResult.publicKey

  return { sig, pubkey }
}
