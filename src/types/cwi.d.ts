export interface GetPublicKeyParams {
  identityKey?: true
  protocolID?: [0 | 1 | 2, string]
  keyID?: string
  counterparty?: string
  forSelf?: boolean
}

export interface GetPublicKeyResult {
  publicKey: string
}

export interface CreateSignatureParams {
  data?: number[]
  hashToDirectlySign?: number[]
  protocolID: [0 | 1 | 2, string]
  keyID: string
  counterparty?: string
  privileged?: boolean
}

export interface CreateSignatureResult {
  signature: number[]
}

export interface ActionOutput {
  lockingScript: string
  satoshis: number
  outputDescription: string
  basket?: string
}

export interface ActionInput {
  outpoint: string
  unlockingScript?: string
  inputDescription?: string
}

export interface CreateActionParams {
  description: string
  inputs?: ActionInput[]
  outputs?: ActionOutput[]
  labels?: string[]
}

export interface CreateActionResult {
  txid: string
  tx?: string
  signableTransaction?: unknown
}

export interface ListMessagesParams {
  messageBox: string
}

export interface Message {
  messageId: string
  sender: string
  messageBox: string
  body: string
  created_at: string
}

export interface ListMessagesResult {
  messages: Message[]
}

export interface SendMessageParams {
  recipient: string
  messageBox: string
  body: string
  messageId?: string
}

export interface AcknowledgeMessageParams {
  messageIds: string[]
}

export interface CWI {
  getPublicKey(params: { identityKey: true }): Promise<GetPublicKeyResult>
  getPublicKey(params: Omit<GetPublicKeyParams, 'identityKey'>): Promise<GetPublicKeyResult>
  createSignature(params: CreateSignatureParams): Promise<CreateSignatureResult>
  createAction(params: CreateActionParams): Promise<CreateActionResult>
  listMessages(params: ListMessagesParams): Promise<ListMessagesResult>
  sendMessage(params: SendMessageParams): Promise<void>
  acknowledgeMessage(params: AcknowledgeMessageParams): Promise<void>
}

declare global {
  interface Window {
    CWI?: CWI
  }
}
