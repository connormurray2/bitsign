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
  try {
    await client.connectToSubstrate()
  } catch (err) {
    // Map the SDK's generic "no substrate" error to our typed error
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('No wallet available') || msg.includes('communication substrate')) {
      throw new WalletNotInstalledError()
    }
    throw err
  }
  const result = await client.getPublicKey({ identityKey: true })
  return result.publicKey
}

/** True when running inside BSV Browser's WebView (window.CWI is injected). */
export function isInBSVBrowser(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).CWI === 'object'
}

/** True when running on a mobile device. */
export function isMobileDevice(): boolean {
  return typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
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
