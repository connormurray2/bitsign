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
  isMultisig?: boolean
  creatorSigningEvent?: CreatorSigningEventInput
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

// Profile
export interface UserProfilePublic {
  firstName: string
  lastName: string
  registrationTxid: string
  commitmentHash: string
}

export interface UserProfileFull extends UserProfilePublic {
  id: string
  identityKey: string
  signatureS3Key: string
  signatureHash: string
  signatureUrl?: string
  initialsS3Key?: string | null
  initialsHash?: string | null
  initialsUrl?: string | null
  createdAt: string
  updatedAt: string
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
  registeredIdentity?: UserProfilePublic | null
  error?: string
}

// POST /api/documents/[id]/multisig
export interface MultisigSignRequest {
  signerToken: string
  sig: string   // DER hex
  pubkey: string
}
export interface MultisigSignResponse {
  isLast: boolean
  allSigs?: Array<{ signerId: string; pubkey: string; sig: string }>
}

// POST /api/documents/[id]/multisig/broadcast
export interface MultisigBroadcastRequest {
  signerToken: string
  txid: string
  outputIndex: number
  lockingScriptHex: string
  rawTxHex?: string
}
export interface MultisigBroadcastResponse {
  success: boolean
}

// POST /api/notify
export interface NotifyRequest {
  documentId: string
}
export interface NotifyResponse {
  notified: number
}
