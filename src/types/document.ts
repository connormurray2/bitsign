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
  signingEvent: SigningEventData | null
}

export interface DocumentData {
  id: string
  title: string
  s3Key: string
  sha256: string
  creatorKey: string
  status: DocStatus
  createdAt: string
  updatedAt: string
  expiresAt: string | null
  signers: SignerData[]
  signingEvents: SigningEventData[]
}
