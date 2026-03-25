'use client'

import { WalletClient } from '@bsv/sdk'

export class WalletNotInstalledError extends Error {
  constructor() {
    super('No BSV wallet found. Open this app in the BSV Browser, or ensure the desktop wallet app is running.')
    this.name = 'WalletNotInstalledError'
  }
}

export class WalletLockedError extends Error {
  constructor() {
    super('BSV wallet is locked. Please unlock your wallet.')
    this.name = 'WalletLockedError'
  }
}

let _walletClient: WalletClient | null = null

export function getWalletClient(): WalletClient {
  if (typeof window === 'undefined') throw new WalletNotInstalledError()
  if (!_walletClient) {
    _walletClient = new WalletClient('auto', window.location.hostname)
  }
  return _walletClient
}

// Connect to wallet and return the identity public key
export async function connectWallet(): Promise<string> {
  const client = getWalletClient()
  await client.connectToSubstrate()
  const result = await client.getPublicKey({ identityKey: true })
  return result.publicKey
}

export function isWalletAvailable(): boolean {
  return typeof window !== 'undefined'
}

export async function getIdentityKey(): Promise<string> {
  return connectWallet()
}

export async function getSigningPublicKey(keyID: string): Promise<string> {
  const client = getWalletClient()
  const result = await client.getPublicKey({
    protocolID: [1, 'bitsign document signing'],
    keyID,
    counterparty: 'self',
  })
  return result.publicKey
}
