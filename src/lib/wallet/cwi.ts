'use client'

import type { CWI } from '@/types/cwi'

export class WalletNotInstalledError extends Error {
  constructor() {
    super('BSV Browser Wallet (window.CWI) is not installed. Please install the BSV Browser Wallet extension.')
    this.name = 'WalletNotInstalledError'
  }
}

export class WalletLockedError extends Error {
  constructor() {
    super('BSV Browser Wallet is locked. Please unlock your wallet.')
    this.name = 'WalletLockedError'
  }
}

export function getCWI(): CWI {
  if (typeof window === 'undefined') {
    throw new WalletNotInstalledError()
  }
  if (!window.CWI) {
    throw new WalletNotInstalledError()
  }
  return window.CWI
}

export function isWalletAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.CWI
}

export async function getIdentityKey(): Promise<string> {
  const cwi = getCWI()
  const result = await cwi.getPublicKey({ identityKey: true })
  return result.publicKey
}

// Get the public key that corresponds to a createSignature call with the same params.
// This is used to determine what pubkey to use as the PUSH DROP owner key.
export async function getSigningPublicKey(keyID: string): Promise<string> {
  const cwi = getCWI()
  const result = await cwi.getPublicKey({
    protocolID: [1, 'bitsign document signing'],
    keyID,
    counterparty: 'self',
  })
  return result.publicKey
}
