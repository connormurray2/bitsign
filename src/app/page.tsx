'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import { isInBSVBrowser, isMobileDevice } from '@/lib/wallet/cwi'

type WalletEnv = 'loading' | 'bsv-browser' | 'mobile' | 'desktop'

const APP_URL = 'https://bitsign-six.vercel.app'

export default function HomePage() {
  const { connected, connecting, connect, error } = useWallet()
  const router = useRouter()
  const [env, setEnv] = useState<WalletEnv>('loading')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isInBSVBrowser()) setEnv('bsv-browser')
    else if (isMobileDevice()) setEnv('mobile')
    else setEnv('desktop')
  }, [])

  useEffect(() => {
    if (connected) router.push('/dashboard')
  }, [connected, router])

  // Auto-connect once we know we're inside BSV Browser
  useEffect(() => {
    if (env === 'bsv-browser' && !connected && !connecting) connect()
  }, [env])

  function copyUrl() {
    navigator.clipboard.writeText(APP_URL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const features = [
    { icon: '🔐', title: 'Cryptographic proof', desc: 'Every signature is an ECDSA-signed UTXO on BSV' },
    { icon: '⛓️', title: 'On-chain audit trail', desc: 'The blockchain is the ledger, not a database flag' },
    { icon: '🪪', title: 'Self-sovereign identity', desc: 'Your BSV wallet key is your signing identity' },
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 text-center">
      <div className="max-w-lg w-full space-y-6">
        {/* Hero */}
        <div>
          <h1 className="text-5xl font-bold text-gray-900">
            Bit<span className="text-blue-600">Sign</span>
          </h1>
          <p className="mt-3 text-xl text-gray-500">
            Document signing anchored on the BSV blockchain.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {features.map((f) => (
            <div key={f.title} className="p-4 bg-white rounded-xl border border-gray-200">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-semibold text-gray-800 text-sm">{f.title}</div>
              <div className="text-gray-500 text-xs mt-1">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* ── Mobile: not in BSV Browser ───────────────────────────────── */}
        {env === 'mobile' && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-left space-y-4">
            <div>
              <p className="font-bold text-blue-900 text-lg">Open BitSign in BSV Browser</p>
              <p className="text-sm text-blue-700 mt-1">
                BitSign requires the BSV Browser wallet. You&apos;re viewing this in a regular browser — open the link below inside BSV Browser to connect your wallet.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white rounded-xl border border-blue-200 px-4 py-3">
                <span className="text-sm font-mono text-gray-700 truncate">{APP_URL}</span>
                <button
                  onClick={copyUrl}
                  className="ml-3 shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <ol className="text-sm text-blue-800 space-y-1.5 list-none">
                <li className="flex gap-2"><span className="font-bold">1.</span> Install BSV Browser from the Play Store or App Store</li>
                <li className="flex gap-2"><span className="font-bold">2.</span> Open BSV Browser and set up your wallet</li>
                <li className="flex gap-2"><span className="font-bold">3.</span> Paste the URL above into BSV Browser&apos;s address bar</li>
              </ol>
            </div>

            <a
              href="https://bsvb.tech/"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Get BSV Browser
            </a>
          </div>
        )}

        {/* ── BSV Browser: connecting ───────────────────────────────────── */}
        {env === 'bsv-browser' && (
          <div className="space-y-3">
            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-2">{error}</p>}
            <button
              onClick={connect}
              disabled={connecting}
              className="w-full px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-lg"
            >
              {connecting ? 'Connecting...' : 'Connect BSV Wallet'}
            </button>
          </div>
        )}

        {/* ── Desktop ───────────────────────────────────────────────────── */}
        {env === 'desktop' && (
          <div className="space-y-3">
            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-2">{error}</p>}
            <button
              onClick={connect}
              disabled={connecting}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-lg"
            >
              {connecting ? 'Connecting...' : 'Connect BSV Wallet'}
            </button>
            <p className="text-xs text-gray-400">
              Requires BSV Browser or a BRC-100 desktop wallet
            </p>
          </div>
        )}

        {env === 'loading' && (
          <div className="h-12 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}
