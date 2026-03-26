export type DocStatus = 'PENDING' | 'COMPLETE' | 'EXPIRED' | 'CANCELLED'
export type SignerStatus = 'PENDING' | 'NOTIFIED' | 'SIGNED'

export interface SigningEventData {
  id: string
  identityKey: string
  txid: string
  outputIndex: number
  docHash: string
  ecdsaSig: string
  timestamp: string
  createdAt: string
}

export interface SignerData {
  id: string
  identityKey: string
  handle: string | null
  order: number
  status: SignerStatus
  token: string
  notifiedAt: string | null
  partialSig: string | null
  partialSigPubkey: string | null
  signingEvent: SigningEventData | null
}

export interface SigningFieldData {
  id: string
  type: string
  page: number
  x: number
  y: number
  width: number
  height: number
  assignedSignerKey: string
  value: string | null
  completedAt: string | null
}

export interface DocumentData {
  id: string
  title: string
  s3Key: string
  sha256: string
  creatorKey: string
  status: DocStatus
  isMultisig: boolean
  createdAt: string
  updatedAt: string
  expiresAt: string | null
  signers: SignerData[]
  signingEvents: SigningEventData[]
  fields?: SigningFieldData[]
}
