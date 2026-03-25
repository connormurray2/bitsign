'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'

export default function HomePage() {
  const { connected, connecting, connect, error } = useWallet()
  const router = useRouter()

  useEffect(() => {
    if (connected) {
      router.push('/dashboard')
    }
  }, [connected, router])

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 text-center">
      <div className="max-w-lg space-y-6">
        <div>
          <h1 className="text-5xl font-bold text-gray-900">
            Bit<span className="text-blue-600">Sign</span>
          </h1>
          <p className="mt-3 text-xl text-gray-500">
            Document signing anchored on the BSV blockchain.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {[
            { icon: '🔐', title: 'Cryptographic proof', desc: 'Every signature is an ECDSA-signed UTXO on BSV' },
            { icon: '⛓️', title: 'On-chain audit trail', desc: 'The blockchain is the ledger, not a database flag' },
            { icon: '🪪', title: 'Self-sovereign identity', desc: 'Your BSV wallet key is your signing identity' },
          ].map((f) => (
            <div key={f.title} className="p-4 bg-white rounded-xl border border-gray-200">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-semibold text-gray-800 text-sm">{f.title}</div>
              <div className="text-gray-500 text-xs mt-1">{f.desc}</div>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-2">{error}</p>
        )}

        <button
          onClick={connect}
          disabled={connecting}
          className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-lg"
        >
          {connecting ? 'Connecting...' : 'Connect BSV Wallet'}
        </button>

        <p className="text-xs text-gray-400">
          Requires the BSV Browser Wallet extension (BRC-100)
        </p>
      </div>
    </div>
  )
}
