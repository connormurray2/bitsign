import { Transaction, PublicKey, Signature, LockingScript } from '@bsv/sdk'
import { decodeBitSignScript, fromHex } from './pushdrop'
import { WOC_API_BASE, BITSIGN_PROTOCOL_ID } from '../utils/constants'

export interface VerificationResult {
  valid: boolean
  txid: string
  docHash: string
  timestamp: string
  docTitle: string
  ownerPubkey: string
  embeddedSignature: string
  signatureValid: boolean
  error?: string
}

async function fetchRawTx(txid: string): Promise<string> {
  const url = `${WOC_API_BASE}/tx/${txid}/hex`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch tx ${txid}: HTTP ${res.status}`)
  }
  return res.text().then((t) => t.trim())
}

export async function verifySigningTx(
  txid: string,
  rawTxHex?: string
): Promise<VerificationResult> {
  const empty: VerificationResult = {
    valid: false,
    txid,
    docHash: '',
    timestamp: '',
    docTitle: '',
    ownerPubkey: '',
    embeddedSignature: '',
    signatureValid: false,
  }

  let rawHex: string
  try {
    rawHex = rawTxHex ?? (await fetchRawTx(txid))
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : 'Failed to fetch transaction' }
  }

  try {
    const tx = Transaction.fromHex(rawHex)
    const output = tx.outputs[0]
    if (!output) throw new Error('Transaction has no outputs')

    const { fields, ownerPubkey, rawFields } = decodeBitSignScript(output.lockingScript.toHex())

    if (fields.protocolId !== BITSIGN_PROTOCOL_ID) {
      throw new Error('Not a BitSign transaction')
    }
    if (!fields.signature) {
      throw new Error('No embedded signature in PUSH DROP script')
    }

    // Verify: PushDrop signs concat(fields[0..3])
    // fields[0]=protocolId, [1]=docHash, [2]=timestamp, [3]=docTitle
    const dataToVerify = rawFields.slice(0, 4).reduce<number[]>((a, e) => [...a, ...e], [])

    const pubkey = PublicKey.fromString(ownerPubkey)
    const sigBytes = fromHex(fields.signature)
    const sig = Signature.fromDER(sigBytes)

    // PushDrop createSignature uses { data: dataToVerify } — the SDK will hash this internally
    // (sha256(data)) before signing. So verify must also hash.
    const signatureValid = pubkey.verify(dataToVerify, sig)

    return {
      valid: signatureValid,
      txid,
      docHash: fields.docHash,
      timestamp: fields.timestamp,
      docTitle: fields.docTitle,
      ownerPubkey,
      embeddedSignature: fields.signature,
      signatureValid,
    }
  } catch (err) {
    return {
      ...empty,
      error: err instanceof Error ? err.message : 'Verification failed',
    }
  }
}
