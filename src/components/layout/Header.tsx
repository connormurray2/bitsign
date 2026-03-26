'use client'

import Link from 'next/link'
import { WalletStatus } from './WalletStatus'
import { useWallet } from '@/hooks/useWallet'
import { useProfile } from '@/hooks/useProfile'

export function Header() {
  const { connected } = useWallet()
  const { profile } = useProfile()

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-blue-600">BitSign</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">BSV</span>
        </Link>

        <nav className="flex items-center gap-6">
          {connected && (
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Dashboard
            </Link>
          )}
          {connected && (
            <Link href="/contacts" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Contacts
            </Link>
          )}
          {connected && (
            <Link href="/documents/new" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              New Document
            </Link>
          )}
          {profile && (
            <span className="text-sm font-medium text-gray-700 hidden sm:block">
              {profile.firstName} {profile.lastName}
            </span>
          )}
          <WalletStatus />
        </nav>
      </div>
    </header>
  )
}
