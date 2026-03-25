'use client'

import { getCWI } from '../wallet/cwi'
import { buildBitSignScript } from './pushdrop'
import { PUSH_DROP_BASKET } from '../utils/constants'

export interface BroadcastResult {
  txid: string
  outputIndex: number
  ownerPubkey: string
  timestamp: string
  lockingScriptHex: string
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
  const cwi = getCWI()
  const timestamp = new Date().toISOString()

  // Build locking script — wallet handles key derivation and signing
  const { lockingScriptHex, ownerPubkey } = await buildBitSignScript(
    cwi as any,
    docHash,
    docTitle,
    timestamp
  )

  // Broadcast transaction
  const result = await cwi.createAction({
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

  return {
    txid: result.txid,
    outputIndex: 0,
    ownerPubkey,
    timestamp,
    lockingScriptHex,
  }
}
