'use client'

import { useWallet } from '@/hooks/useWallet'

export function WalletStatus() {
  const { connected, identityKey, connecting, error, connect, disconnect } = useWallet()

  if (connecting) {
    return (
      <button disabled className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed">
        Connecting...
      </button>
    )
  }

  if (connected && identityKey) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-600 font-mono">
            {identityKey.slice(0, 8)}...{identityKey.slice(-6)}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-sm text-red-500">{error}</span>}
      <button
        onClick={connect}
        className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
      >
        Connect Wallet
      </button>
    </div>
  )
}
