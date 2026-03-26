'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import { useProfile } from '@/hooks/useProfile'
import { SignatureCanvas } from '@/components/signing/SignatureCanvas'
import { sha256DataUrl, broadcastIdentityRegistration } from '@/lib/bsv/identity'
import { BSV_EXPLORER_TX_URL } from '@/lib/utils/constants'

type Step = 'name' | 'signature' | 'initials' | 'preview' | 'processing' | 'done'

function OnboardingContent() {
  const { connected, identityKey, connect } = useWallet()
  const { hasProfile, mutate } = useProfile()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('return') ?? '/dashboard'

  const [step, setStep] = useState<Step>('name')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [initialsDataUrl, setInitialsDataUrl] = useState<string | null>(null)
  const [showCanvas, setShowCanvas] = useState(false)
  const [canvasType, setCanvasType] = useState<'signature' | 'initials'>('signature')
  const [processingStep, setProcessingStep] = useState('')
  const [error, setError] = useState('')
  const [registrationTxid, setRegistrationTxid] = useState('')

  // Redirect if already has profile
  useEffect(() => {
    if (hasProfile) router.replace(returnTo)
  }, [hasProfile])

  async function handleRegister() {
    if (!identityKey || !signatureDataUrl) return
    setStep('processing')
    setError('')

    try {
      // 1. Hash the signature PNG
      setProcessingStep('Hashing signature...')
      const signatureHash = await sha256DataUrl(signatureDataUrl)

      // 2. Upload signature PNG to S3
      setProcessingStep('Uploading signature...')
      const sigBlob = new Blob(
        [Uint8Array.from(atob(signatureDataUrl.split(',')[1]), (c) => c.charCodeAt(0))],
        { type: 'image/png' }
      )
      const sigUploadRes = await fetch('/api/upload/signature', { method: 'POST' })
      if (!sigUploadRes.ok) throw new Error('Failed to get signature upload URL')
      const { presignedUrl: sigUrl, s3Key: signatureS3Key } = await sigUploadRes.json()
      await fetch(sigUrl, { method: 'PUT', body: sigBlob, headers: { 'Content-Type': 'image/png' } })

      // 3. Hash + upload initials PNG (if provided)
      let initialsHash: string | undefined
      let initialsS3Key: string | undefined
      if (initialsDataUrl) {
        setProcessingStep('Uploading initials...')
        initialsHash = await sha256DataUrl(initialsDataUrl)
        const initBlob = new Blob(
          [Uint8Array.from(atob(initialsDataUrl.split(',')[1]), (c) => c.charCodeAt(0))],
          { type: 'image/png' }
        )
        const initUploadRes = await fetch('/api/upload/signature', { method: 'POST' })
        if (!initUploadRes.ok) throw new Error('Failed to get initials upload URL')
        const { presignedUrl: initUrl, s3Key: initKey } = await initUploadRes.json()
        initialsS3Key = initKey
        await fetch(initUrl, { method: 'PUT', body: initBlob, headers: { 'Content-Type': 'image/png' } })
      }

      // 4. Broadcast identity PUSH DROP
      setProcessingStep('Broadcasting identity to BSV blockchain...')
      const { txid, commitmentHash } = await broadcastIdentityRegistration(firstName, lastName, signatureHash, initialsHash)
      setRegistrationTxid(txid)

      // 5. Save to DB
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
      setTimeout(() => router.push(returnTo), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
      setStep('preview')
    }
  }

  if (!connected) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Welcome to BitSign</h1>
        <p className="text-gray-600">Connect your BSV wallet to create your identity profile.</p>
        <button onClick={connect} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">
          Connect BSV Wallet
        </button>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-3xl mx-auto">✓</div>
        <h1 className="text-2xl font-bold text-gray-900">Identity Registered</h1>
        <p className="text-gray-500">Your identity has been anchored on the BSV blockchain.</p>
        {registrationTxid && (
          <a
            href={`${BSV_EXPLORER_TX_URL}/${registrationTxid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-mono text-blue-600 hover:underline break-all"
          >
            {registrationTxid}
          </a>
        )}
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
      {/* Progress */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Create Your Identity</h1>
        <p className="text-sm text-gray-500">
          Your name and signature will be permanently linked to your BSV identity key on the blockchain.
        </p>
      </div>

      <div className="flex gap-2 text-xs text-gray-400">
        {['name', 'signature', 'initials', 'preview'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${step === s ? 'bg-blue-600 text-white' : ['name','signature','initials','preview'].indexOf(step) > i ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {['name','signature','initials','preview'].indexOf(step) > i ? '✓' : i + 1}
            </div>
            <span className={step === s ? 'text-gray-700 font-medium' : ''}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
            {i < 3 && <span>→</span>}
          </div>
        ))}
      </div>

      {/* Step: Name */}
      {step === 'name' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Your Legal Name</h2>
          <div className="space-y-3">
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
              onKeyDown={(e) => { if (e.key === 'Enter' && firstName.trim() && lastName.trim()) setStep('signature') }}
            />
          </div>
          <button
            onClick={() => setStep('signature')}
            disabled={!firstName.trim() || !lastName.trim()}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Step: Signature */}
      {step === 'signature' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Your Signature</h2>
          <p className="text-sm text-gray-500">
            Draw the signature you use to sign documents. This will be saved and reused each time you sign.
          </p>
          {signatureDataUrl ? (
            <div className="space-y-3">
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <img src={signatureDataUrl} alt="Your signature" className="max-h-24 mx-auto" />
              </div>
              <button onClick={() => { setCanvasType('signature'); setShowCanvas(true) }} className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                Redraw
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setCanvasType('signature'); setShowCanvas(true) }}
              className="w-full py-12 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              Tap to draw your signature
            </button>
          )}
          <div className="flex gap-2">
            <button onClick={() => setStep('name')} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Back
            </button>
            <button
              onClick={() => setStep('initials')}
              disabled={!signatureDataUrl}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step: Initials */}
      {step === 'initials' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Your Initials</h2>
          <p className="text-sm text-gray-500">
            Draw your initials — used when documents require initials rather than a full signature.
          </p>
          {initialsDataUrl ? (
            <div className="space-y-3">
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <img src={initialsDataUrl} alt="Your initials" className="max-h-24 mx-auto" />
              </div>
              <button onClick={() => { setCanvasType('initials'); setShowCanvas(true) }} className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                Redraw
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setCanvasType('initials'); setShowCanvas(true) }}
              className="w-full py-12 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              Tap to draw your initials
            </button>
          )}
          <div className="flex gap-2">
            <button onClick={() => setStep('signature')} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Back
            </button>
            <button
              onClick={() => setStep('preview')}
              disabled={!initialsDataUrl}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Confirm Your Identity</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Name</span>
              <span className="font-semibold text-gray-900">{firstName} {lastName}</span>
            </div>
            <div className="py-2 border-b border-gray-100 space-y-1">
              <span className="text-gray-500">Signature</span>
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 mt-2">
                {signatureDataUrl && <img src={signatureDataUrl} alt="Signature preview" className="max-h-16 mx-auto" />}
              </div>
            </div>
            <div className="py-2 border-b border-gray-100 space-y-1">
              <span className="text-gray-500">Initials</span>
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 mt-2">
                {initialsDataUrl && <img src={initialsDataUrl} alt="Initials preview" className="max-h-16 mx-auto" />}
              </div>
            </div>
            <p className="text-xs text-gray-400">
              A hash of this information will be permanently recorded on the BSV blockchain, linked to your identity key.
            </p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setStep('initials')} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Back
            </button>
            <button
              onClick={handleRegister}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
            >
              Register Identity
            </button>
          </div>
        </div>
      )}

      {showCanvas && (
        <SignatureCanvas
          type={canvasType}
          onSave={(dataUrl) => {
            if (canvasType === 'signature') setSignatureDataUrl(dataUrl)
            else setInitialsDataUrl(dataUrl)
            setShowCanvas(false)
          }}
          onCancel={() => setShowCanvas(false)}
        />
      )}
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  )
}
