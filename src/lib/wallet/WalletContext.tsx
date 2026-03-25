'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { connectWallet, isWalletAvailable, WalletNotInstalledError } from './cwi'

interface WalletState {
  connected: boolean
  identityKey: string | null
  connecting: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletState>({
  connected: false,
  identityKey: null,
  connecting: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
})

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [identityKey, setIdentityKey] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Attempt to restore session from sessionStorage on mount
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem('bitsign_identity_key') : null
    if (stored) {
      setIdentityKey(stored)
      setConnected(true)
    }
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      const key = await connectWallet()
      setIdentityKey(key)
      setConnected(true)
      sessionStorage.setItem('bitsign_identity_key', key)
    } catch (err) {
      if (err instanceof WalletNotInstalledError) {
        setError('No BSV wallet found. Open this app in the BSV Browser app, or start the desktop wallet.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to connect wallet')
      }
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setConnected(false)
    setIdentityKey(null)
    sessionStorage.removeItem('bitsign_identity_key')
  }, [])

  return (
    <WalletContext.Provider value={{ connected, identityKey, connecting, error, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWalletContext(): WalletState {
  return useContext(WalletContext)
}
