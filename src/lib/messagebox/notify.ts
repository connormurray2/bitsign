/**
 * Server-side MessageBox P2P notification system.
 *
 * Uses a dedicated notification private key (BSV_NOTIFY_PRIVATE_KEY) to send
 * signing invitations to signers via their BSV identity key.
 *
 * The recipient must poll their 'bitsign-invites' MessageBox to receive invites.
 * This is done in the dashboard via the wallet's listMessages API.
 */

export interface BitSignInviteMessage {
  type: 'bitsign-invite'
  version: '1.0'
  documentId: string
  documentTitle: string
  creatorIdentityKey: string
  signerToken: string
  inviteUrl: string
  docHash: string
  totalSigners: number
  yourSigningOrder: number
}

export const INVITE_MESSAGE_BOX = 'bitsign-invites'

/**
 * Send a signing invitation via BSV MessageBox.
 *
 * NOTE: Server-side MessageBox send requires a wallet context. The full
 * implementation uses @bsv/sdk with BSV_NOTIFY_PRIVATE_KEY. For MVP, this
 * function constructs the invite payload and the client-side handles sending
 * via window.CWI after the document is created.
 *
 * Full server-side implementation requires @bsv/wallet-toolbox server wallet.
 */
export function buildInviteMessage(params: {
  documentId: string
  documentTitle: string
  creatorIdentityKey: string
  signerToken: string
  docHash: string
  totalSigners: number
  signingOrder: number
}): BitSignInviteMessage {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return {
    type: 'bitsign-invite',
    version: '1.0',
    documentId: params.documentId,
    documentTitle: params.documentTitle,
    creatorIdentityKey: params.creatorIdentityKey,
    signerToken: params.signerToken,
    inviteUrl: `${appUrl}/documents/sign/${params.signerToken}`,
    docHash: params.docHash,
    totalSigners: params.totalSigners,
    yourSigningOrder: params.signingOrder,
  }
}
