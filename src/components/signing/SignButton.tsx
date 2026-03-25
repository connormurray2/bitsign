'use client'

import { useState } from 'react'
import { signAndBroadcastDocument } from '@/lib/bsv/broadcast'
import type { BroadcastResult } from '@/lib/bsv/broadcast'

interface Props {
  docHash: string
  docTitle: string
  onSuccess: (result: BroadcastResult) => void
  onError?: (err: Error) => void
  disabled?: boolean
}

export function SignButton({ docHash, docTitle, onSuccess, onError, disabled }: Props) {
  const [signing, setSigning] = useState(false)
  const [step, setStep] = useState('')

  async function handleSign() {
    setSigning(true)
    setStep('Requesting signature from wallet...')
    try {
      setStep('Signing document hash...')
      const result = await signAndBroadcastDocument(docHash, docTitle)
      setStep('Broadcasting transaction...')
      onSuccess(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      onError?.(error)
      setStep('')
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSign}
        disabled={disabled || signing}
        className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {signing ? 'Signing...' : 'Sign Document'}
      </button>
      {signing && step && (
        <p className="text-sm text-center text-gray-500">{step}</p>
      )}
    </div>
  )
}
