/**
 * BitSign PUSH DROP script helpers.
 *
 * Uses the @bsv/sdk PushDrop class which wraps a wallet interface.
 * PushDrop.lock() calls wallet.getPublicKey + wallet.createSignature automatically.
 *
 * On-chain field layout (PushDrop, lockPosition='before'):
 *   <ownerPubkey> OP_CHECKSIG
 *   <field[0]: "bitsign">
 *   <field[1]: docHash hex bytes>
 *   <field[2]: timestamp UTF-8>
 *   <field[3]: docTitle UTF-8>
 *   <field[4]: signature — auto-added by PushDrop (ECDSA of concat(field[0..3]))>
 *   OP_2DROP OP_2DROP OP_DROP
 */

import { PushDrop, LockingScript, Utils } from '@bsv/sdk'
import { BITSIGN_PROTOCOL_ID } from '../utils/constants'

export interface BitSignFields {
  protocolId: string
  docHash: string
  timestamp: string
  docTitle: string
  signature?: string  // hex DER — auto field[4], populated on decode
}

function toBytes(str: string): number[] {
  return Array.from(new TextEncoder().encode(str))
}

export function fromHex(hex: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16))
  }
  return bytes
}

function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function bytesToString(bytes: number[]): string {
  return new TextDecoder().decode(new Uint8Array(bytes))
}

/**
 * Build a BitSign PUSH DROP locking script.
 *
 * Must be called client-side (requires window.CWI wallet).
 * The wallet is used to derive the owner pubkey and sign the field data.
 *
 * @param wallet - The CWI wallet interface (window.CWI)
 * @param docHash - Hex SHA-256 of the document
 * @param docTitle - Human-readable document title
 * @param docTimestamp - ISO timestamp string
 * @returns { lockingScriptHex, ownerPubkey }
 */
export async function buildBitSignScript(
  wallet: { getPublicKey: Function; createSignature: Function },
  docHash: string,
  docTitle: string,
  docTimestamp: string
): Promise<{ lockingScriptHex: string; ownerPubkey: string }> {
  const pd = new PushDrop(wallet as any)

  const fields: number[][] = [
    toBytes(BITSIGN_PROTOCOL_ID),
    fromHex(docHash),
    toBytes(docTimestamp),
    toBytes(docTitle),
  ]

  // lock() will:
  // 1. Call wallet.getPublicKey({ protocolID, keyID, counterparty }) for owner lock
  // 2. Call wallet.createSignature({ data: concat(fields), ... }) for embedded sig
  // 3. Append the sig as fields[4], then build the locking script
  const lockingScript = await pd.lock(
    fields,
    [1, 'bitsign document signing'],
    docHash,  // keyID = document hash — unique per document
    'self'
  )

  // Get the owner pubkey (same derivation params)
  const { publicKey: ownerPubkey } = await wallet.getPublicKey({
    protocolID: [1, 'bitsign document signing'],
    keyID: docHash,
    counterparty: 'self',
  })

  return {
    lockingScriptHex: lockingScript.toHex(),
    ownerPubkey,
  }
}

/**
 * Decode a BitSign PUSH DROP locking script.
 * This is a pure function — no wallet required.
 *
 * @param lockingScriptHex - Hex-encoded locking script
 * @returns Decoded fields and owner pubkey
 */
export function decodeBitSignScript(lockingScriptHex: string): {
  fields: BitSignFields
  ownerPubkey: string
  rawFields: number[][]
} {
  const script = LockingScript.fromHex(lockingScriptHex)
  const decoded = PushDrop.decode(script, 'before')

  if (!decoded || !decoded.fields || decoded.fields.length < 4) {
    throw new Error(`Invalid BitSign PUSH DROP script: expected at least 4 fields, got ${decoded?.fields?.length ?? 0}`)
  }

  const rawFields = decoded.fields as number[][]
  const [f0, f1, f2, f3, f4] = rawFields

  const protocolId = bytesToString(f0)
  if (protocolId !== BITSIGN_PROTOCOL_ID) {
    throw new Error(`Invalid protocol identifier: expected "${BITSIGN_PROTOCOL_ID}", got "${protocolId}"`)
  }

  return {
    fields: {
      protocolId,
      docHash: bytesToHex(f1),
      timestamp: bytesToString(f2),
      docTitle: bytesToString(f3),
      signature: f4 ? bytesToHex(f4) : undefined,
    },
    ownerPubkey: decoded.lockingPublicKey?.toString() ?? '',
    rawFields,
  }
}
