import type { DocumentData, SignerData, SigningEventData } from './document'

// POST /api/upload
export interface UploadRequest {
  filename: string
  contentType: string
  sha256: string
}
export interface UploadResponse {
  presignedUrl: string
  s3Key: string
}

// POST /api/documents
export interface SignerInput {
  identityKey: string
  handle?: string
  order: number
}
export interface CreatorSigningEventInput {
  txid: string
  outputIndex: number
  ownerPubkey: string
  timestamp: string
  lockingScriptHex: string
  rawTxHex?: string
}
export interface CreateDocumentRequest {
  title: string
  s3Key: string
  sha256: string
  creatorIdentityKey: string
  signers: SignerInput[]
  creatorSigningEvent: CreatorSigningEventInput
}
export interface CreateDocumentResponse {
  document: DocumentData
}

// GET /api/documents/[id]
export interface GetDocumentResponse {
  document: DocumentData
  downloadUrl?: string
}

// POST /api/sign
export interface SignRequest {
  documentId: string
  signerToken: string
  txid: string
  outputIndex: number
  ownerPubkey: string
  timestamp: string
  lockingScriptHex: string
  rawTxHex?: string
}
export interface SignResponse {
  signingEvent: SigningEventData
  documentComplete: boolean
}

// GET /api/verify
export interface VerifyResponse {
  valid: boolean
  txid: string
  docHash: string
  embeddedSignature: string
  timestamp: string
  docTitle: string
  ownerPubkey: string
  signatureValid: boolean
  documentId?: string
  error?: string
}

// POST /api/notify
export interface NotifyRequest {
  documentId: string
}
export interface NotifyResponse {
  notified: number
}
