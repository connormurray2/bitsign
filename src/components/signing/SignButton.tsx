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
  fieldValues?: { fieldId: string; value: string }[]
}

export function SignButton({ docHash, docTitle, onSuccess, onError, disabled, fieldValues }: Props) {
  const [signing, setSigning] = useState(false)
  const [step, setStep] = useState('')

  async function handleSign() {
    setSigning(true)
    setStep('Requesting signature from wallet...')
    try {
      // If field values exist, hash them into the commitment
      let hashToSign = docHash
      if (fieldValues && fieldValues.length > 0) {
        const fieldValuesString = JSON.stringify(fieldValues)
        const encoder = new TextEncoder()
        const data = encoder.encode(docHash + fieldValuesString)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        hashToSign = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      }

      setStep('Signing document hash...')
      const result = await signAndBroadcastDocument(hashToSign, docTitle)
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
