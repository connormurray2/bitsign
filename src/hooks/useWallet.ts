'use client'

import { useWalletContext } from '@/lib/wallet/WalletContext'

export function useWallet() {
  return useWalletContext()
}
