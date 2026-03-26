'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import { useProfile } from '@/hooks/useProfile'
import { SignatureCanvas } from '@/components/signing/SignatureCanvas'
import { sha256DataUrl, broadcastIdentityRegistration } from '@/lib/bsv/identity'
import { TxLink } from '@/components/blockchain/TxLink'

type Step = 'edit' | 'preview' | 'processing' | 'done'

export default function ProfileEditPage() {
  const router = useRouter()
  const { connected, identityKey } = useWallet()
  const { profile, isLoading, mutate } = useProfile()

  const [step, setStep] = useState<Step>('edit')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [newSignatureDataUrl, setNewSignatureDataUrl] = useState<string | null>(null)
  const [newInitialsDataUrl, setNewInitialsDataUrl] = useState<string | null>(null)
  const [showCanvas, setShowCanvas] = useState(false)
  const [canvasType, setCanvasType] = useState<'signature' | 'initials'>('signature')
  const [processingStep, setProcessingStep] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName)
      setLastName(profile.lastName)
    }
  }, [profile?.firstName, profile?.lastName])

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] text-gray-400">
        Please connect your wallet.
      </div>
    )
  }

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] text-gray-400">
        Loading...
      </div>
    )
  }

  const previewSignatureUrl = newSignatureDataUrl ?? profile.signatureUrl ?? null
  const previewInitialsUrl = newInitialsDataUrl ?? profile.initialsUrl ?? null

  async function uploadPng(dataUrl: string): Promise<{ s3Key: string; hash: string }> {
    const hash = await sha256DataUrl(dataUrl)
    const blob = new Blob(
      [Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0))],
      { type: 'image/png' }
    )
    const res = await fetch('/api/upload/signature', { method: 'POST' })
    if (!res.ok) throw new Error('Failed to get upload URL')
    const { presignedUrl, s3Key } = await res.json()
    await fetch(presignedUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/png' } })
    return { s3Key, hash }
  }

  async function handleUpdate() {
    if (!identityKey) return
    setStep('processing')
    setError('')

    try {
      let signatureS3Key = profile!.signatureS3Key
      let signatureHash = profile!.signatureHash
      let initialsS3Key = profile!.initialsS3Key ?? undefined
      let initialsHash = profile!.initialsHash ?? undefined

      if (newSignatureDataUrl) {
        setProcessingStep('Uploading signature...')
        const r = await uploadPng(newSignatureDataUrl)
        signatureS3Key = r.s3Key
        signatureHash = r.hash
      }

      if (newInitialsDataUrl) {
        setProcessingStep('Uploading initials...')
        const r = await uploadPng(newInitialsDataUrl)
        initialsS3Key = r.s3Key
        initialsHash = r.hash
      }

      setProcessingStep('Broadcasting updated identity to BSV blockchain...')
      const { txid, commitmentHash } = await broadcastIdentityRegistration(
        firstName, lastName, signatureHash, initialsHash
      )

      setProcessingStep('Saving profile...')
      const saveRes = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-identity-key': identityKey },
        body: JSON.stringify({ firstName, lastName, signatureS3Key, signatureHash, initialsS3Key, initialsHash, registrationTxid: txid, commitmentHash }),
      })
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to save profile')
      }

      await mutate()
      setStep('done')
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
      setStep('preview')
    }
  }

  if (step === 'done') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-3xl mx-auto">✓</div>
        <h1 className="text-2xl font-bold text-gray-900">Profile Updated</h1>
        <p className="text-gray-500">Your updated identity has been anchored on the BSV blockchain.</p>
      </div>
    )
  }

  if (step === 'processing') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-700 font-medium">{processingStep}</p>
        <p className="text-xs text-gray-400">If your wallet shows an approval prompt, please confirm it.</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Changes are anchored on-chain as a new identity registration.</p>
      </div>

      {/* Current on-chain registration */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Identity Registration</h2>
        <p className="text-xs text-gray-500">
          Your identity is anchored on the BSV blockchain. Each update creates a new on-chain record.
        </p>
        <TxLink txid={profile.registrationTxid} variant="full" />
        <p className="text-xs font-mono text-gray-400 break-all">
          Commitment: {profile.commitmentHash}
        </p>
      </div>

      {step === 'edit' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          {/* Name */}
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-800 text-sm">Name</h2>
            <input
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400"
            />
            <input
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Signature */}
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-800 text-sm">Signature</h2>
            {newSignatureDataUrl ? (
              <div className="space-y-2">
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <img src={newSignatureDataUrl} alt="New signature" className="max-h-20 mx-auto" />
                </div>
                <p className="text-xs text-green-600 font-medium">New signature drawn</p>
              </div>
            ) : profile.signatureUrl ? (
              <div className="space-y-2">
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <img src={profile.signatureUrl} alt="Current signature" className="max-h-20 mx-auto" />
                </div>
                <p className="text-xs text-gray-400">Current — redraw to change</p>
              </div>
            ) : null}
            <button
              onClick={() => { setCanvasType('signature'); setShowCanvas(true) }}
              className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
            >
              {newSignatureDataUrl || profile.signatureUrl ? 'Redraw Signature' : 'Draw Signature'}
            </button>
          </div>

          {/* Initials */}
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-800 text-sm">Initials</h2>
            {newInitialsDataUrl ? (
              <div className="space-y-2">
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <img src={newInitialsDataUrl} alt="New initials" className="max-h-20 mx-auto" />
                </div>
                <p className="text-xs text-green-600 font-medium">New initials drawn</p>
              </div>
            ) : profile.initialsUrl ? (
              <div className="space-y-2">
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <img src={profile.initialsUrl} alt="Current initials" className="max-h-20 mx-auto" />
                </div>
                <p className="text-xs text-gray-400">Current — redraw to change</p>
              </div>
            ) : null}
            <button
              onClick={() => { setCanvasType('initials'); setShowCanvas(true) }}
              className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
            >
              {newInitialsDataUrl || profile.initialsUrl ? 'Redraw Initials' : 'Draw Initials'}
            </button>
          </div>

          <button
            onClick={() => setStep('preview')}
            disabled={!firstName.trim() || !lastName.trim() || (!newSignatureDataUrl && !profile.signatureUrl)}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Review Changes
          </button>
        </div>
      )}

      {step === 'preview' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Confirm Update</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Name</span>
              <span className="font-semibold text-gray-900">{firstName} {lastName}</span>
            </div>
            <div className="py-2 border-b border-gray-100 space-y-2">
              <span className="text-gray-500">Signature</span>
              {previewSignatureUrl && (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 mt-2">
                  <img src={previewSignatureUrl} alt="Signature" className="max-h-16 mx-auto" />
                </div>
              )}
              {newSignatureDataUrl && <p className="text-xs text-green-600">New signature will be saved</p>}
            </div>
            <div className="py-2 border-b border-gray-100 space-y-2">
              <span className="text-gray-500">Initials</span>
              {previewInitialsUrl && (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 mt-2">
                  <img src={previewInitialsUrl} alt="Initials" className="max-h-16 mx-auto" />
                </div>
              )}
              {newInitialsDataUrl && <p className="text-xs text-green-600">New initials will be saved</p>}
            </div>
            <p className="text-xs text-gray-400">
              A new identity registration will be broadcast to the BSV blockchain.
            </p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setStep('edit')} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Back
            </button>
            <button
              onClick={handleUpdate}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
            >
              Update Identity
            </button>
          </div>
        </div>
      )}

      {showCanvas && (
        <SignatureCanvas
          type={canvasType}
          onSave={(dataUrl) => {
            if (canvasType === 'signature') setNewSignatureDataUrl(dataUrl)
            else setNewInitialsDataUrl(dataUrl)
            setShowCanvas(false)
          }}
          onCancel={() => setShowCanvas(false)}
        />
      )}
    </div>
  )
}
