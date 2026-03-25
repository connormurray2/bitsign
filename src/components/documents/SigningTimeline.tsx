'use client'

import type { SignerData } from '@/types/document'
import { BSV_EXPLORER_TX_URL } from '@/lib/utils/constants'

interface Props {
  signers: SignerData[]
}

export function SigningTimeline({ signers }: Props) {
  return (
    <div className="space-y-3">
      {signers.map((signer, idx) => (
        <div key={signer.id} className="flex items-start gap-3">
          {/* Step indicator */}
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                ${signer.status === 'SIGNED' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              {signer.status === 'SIGNED' ? '✓' : idx + 1}
            </div>
            {idx < signers.length - 1 && (
              <div className={`w-0.5 h-6 mt-1 ${signer.status === 'SIGNED' ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </div>

          {/* Signer info */}
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-gray-700">
                {signer.handle ?? `${signer.identityKey.slice(0, 10)}...${signer.identityKey.slice(-6)}`}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${signer.status === 'SIGNED' ? 'bg-green-100 text-green-700' :
                    signer.status === 'NOTIFIED' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'}`}
              >
                {signer.status}
              </span>
            </div>

            {signer.signingEvent ? (
              <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                <div>
                  Signed {new Date(signer.signingEvent.timestamp).toLocaleString()}
                </div>
                <div>
                  TX:{' '}
                  <a
                    href={`${BSV_EXPLORER_TX_URL}/${signer.signingEvent.txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline font-mono"
                  >
                    {signer.signingEvent.txid.slice(0, 16)}...
                  </a>
                </div>
              </div>
            ) : signer.status === 'SIGNED' ? (
              <div className="mt-1 text-xs text-amber-600">
                Signature submitted — awaiting final broadcast
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
