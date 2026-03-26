'use client'

import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { SignatureCanvas } from './SignatureCanvas'

// Use local worker matching react-pdf's bundled pdfjs version
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.react-pdf.min.mjs'

interface SigningField {
  id: string
  type: string
  page: number
  x: number
  y: number
  width: number
  height: number
  assignedSignerKey: string
  value?: string | null
  completedAt?: string | null
}

interface GuidedSigningFlowProps {
  pdfUrl: string
  fields: SigningField[]
  onComplete: (fieldValues: { fieldId: string; value: string }[]) => void
  onCancel: () => void
}

export function GuidedSigningFlow({ pdfUrl, fields, onComplete, onCancel }: GuidedSigningFlowProps) {
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0)
  const [fieldValues, setFieldValues] = useState<Map<string, string>>(new Map())
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [numPages, setNumPages] = useState<number>(0)
  const [pageWidth, setPageWidth] = useState(600)

  const currentField = fields[currentFieldIndex]
  const isLastField = currentFieldIndex === fields.length - 1
  const currentValue = fieldValues.get(currentField?.id)

  // Auto-navigate to the current field's page
  const currentPage = currentField?.page ?? 1

  useEffect(() => {
    // Update page width based on container
    const updateWidth = () => {
      const container = document.querySelector('.pdf-container')
      if (container) {
        setPageWidth(Math.min(600, container.clientWidth - 32))
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  function handleFieldComplete(value: string) {
    const newValues = new Map(fieldValues)
    newValues.set(currentField.id, value)
    setFieldValues(newValues)
    setTextInput('')
    setShowSignatureCanvas(false)

    if (isLastField) {
      // All fields complete - convert Map to array for API
      const valuesArray = Array.from(newValues.entries()).map(([fieldId, value]) => ({
        fieldId,
        value,
      }))
      onComplete(valuesArray)
    } else {
      // Move to next field
      setCurrentFieldIndex((i) => i + 1)
    }
  }

  function handleSignatureComplete(dataUrl: string) {
    handleFieldComplete(dataUrl)
  }

  function handleDateComplete() {
    const isoDate = new Date().toISOString()
    handleFieldComplete(isoDate)
  }

  function handleTextComplete() {
    if (textInput.trim()) {
      handleFieldComplete(textInput.trim())
    }
  }

  function handlePrevious() {
    if (currentFieldIndex > 0) {
      setCurrentFieldIndex((i) => i - 1)
    }
  }

  // Calculate field position as percentage of page dimensions
  function getFieldStyle(field: SigningField) {
    // PDF coordinates are in points, we need to convert to percentage
    return {
      position: 'absolute' as const,
      left: `${field.x}%`,
      top: `${field.y}%`,
      width: `${field.width}%`,
      height: `${field.height}%`,
      border: '3px solid #3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderRadius: '4px',
      pointerEvents: 'none' as const,
      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    }
  }

  if (!currentField) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-blue-900">
            Field {currentFieldIndex + 1} of {fields.length}
          </div>
          <div className="text-xs text-blue-600">
            {Math.round(((currentFieldIndex + 1) / fields.length) * 100)}% complete
          </div>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentFieldIndex + 1) / fields.length) * 100}%` }}
          />
        </div>
      </div>

      {/* PDF with highlighted field */}
      <div className="pdf-container border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
        <div className="relative">
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={
              <div className="flex items-center justify-center h-64 text-gray-400">
                Loading PDF...
              </div>
            }
            error={
              <div className="flex items-center justify-center h-64 text-red-500">
                Failed to load PDF.
              </div>
            }
          >
            <div className="relative">
              <Page
                pageNumber={currentPage}
                width={pageWidth}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
              {/* Highlight current field */}
              {currentField.page === currentPage && (
                <div style={getFieldStyle(currentField)} />
              )}
            </div>
          </Document>

          {numPages > 1 && (
            <div className="flex items-center justify-center gap-4 p-3 border-t border-gray-200 bg-white">
              <span className="text-sm text-gray-600">
                Page {currentPage} of {numPages}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Field input area */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="text-sm font-semibold text-gray-900">
          {currentField.type === 'signature' && 'Signature Required'}
          {currentField.type === 'initials' && 'Initials Required'}
          {currentField.type === 'date' && 'Date Required'}
          {currentField.type === 'text' && 'Text Input Required'}
        </div>

        {currentValue ? (
          <div className="space-y-2">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800 text-sm">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Completed</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {currentField.type === 'signature' && (
              <button
                onClick={() => setShowSignatureCanvas(true)}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                Click to Sign
              </button>
            )}

            {currentField.type === 'initials' && (
              <button
                onClick={() => setShowSignatureCanvas(true)}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                Click to Add Initials
              </button>
            )}

            {currentField.type === 'date' && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  Current date: {new Date().toLocaleDateString()}
                </div>
                <button
                  onClick={handleDateComplete}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                >
                  Confirm Date
                </button>
              </div>
            )}

            {currentField.type === 'text' && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Enter text..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && textInput.trim()) {
                      handleTextComplete()
                    }
                  }}
                />
                <button
                  onClick={handleTextComplete}
                  disabled={!textInput.trim()}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm
                </button>
              </div>
            )}
          </>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-2 pt-2 border-t border-gray-200">
          <button
            onClick={handlePrevious}
            disabled={currentFieldIndex === 0}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          {isLastField && currentValue && (
            <button
              onClick={() => {
                const valuesArray = Array.from(fieldValues.entries()).map(([fieldId, value]) => ({
                  fieldId,
                  value,
                }))
                onComplete(valuesArray)
              }}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
            >
              Sign Document
            </button>
          )}
        </div>
      </div>

      {/* Signature canvas modal */}
      {showSignatureCanvas && (
        <SignatureCanvas
          type={currentField.type as 'signature' | 'initials'}
          onSave={handleSignatureComplete}
          onCancel={() => setShowSignatureCanvas(false)}
        />
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  )
}
