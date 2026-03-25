'use client'

import { Transaction } from '@bsv/sdk'
import { getWalletClient } from '../wallet/cwi'
import { buildBitSignScript } from './pushdrop'
import { PUSH_DROP_BASKET } from '../utils/constants'

export interface BroadcastResult {
  txid: string
  outputIndex: number
  ownerPubkey: string
  timestamp: string
  lockingScriptHex: string
  rawTxHex?: string
}

/**
 * Sign a document and broadcast a PUSH DROP transaction to BSV.
 *
 * Steps:
 * 1. Build PUSH DROP locking script via wallet (derives key, signs fields)
 * 2. Broadcast via wallet.createAction()
 *
 * @param docHash - Hex SHA-256 of the document
 * @param docTitle - Document title
 */
export async function signAndBroadcastDocument(
  docHash: string,
  docTitle: string
): Promise<BroadcastResult> {
  const wallet = getWalletClient()
  const timestamp = new Date().toISOString()

  // Build locking script — wallet handles key derivation and signing
  const { lockingScriptHex, ownerPubkey } = await buildBitSignScript(
    wallet as any,
    docHash,
    docTitle,
    timestamp
  )

  // Broadcast transaction
  const result = await wallet.createAction({
    description: `BitSign: ${docTitle}`,
    outputs: [
      {
        lockingScript: lockingScriptHex,
        satoshis: 1,
        outputDescription: 'BitSign document signing event',
        basket: PUSH_DROP_BASKET,
      },
    ],
    labels: ['bitsign'],
  })

  if (!result.txid) throw new Error('Wallet did not return a txid — transaction may be pending signature')

  let rawTxHex: string | undefined
  if (result.tx) {
    try {
      rawTxHex = Transaction.fromAtomicBEEF(result.tx as number[]).toHex()
    } catch {
      // BEEF parse failed — server will fall back to WoC
    }
  }

  return {
    txid: result.txid,
    outputIndex: 0,
    ownerPubkey,
    timestamp,
    lockingScriptHex,
    rawTxHex,
  }
}
