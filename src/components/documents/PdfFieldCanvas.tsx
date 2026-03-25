'use client'

import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { isMobileDevice } from '@/lib/wallet/cwi'

// Worker will be configured in useEffect before loading PDF

export type FieldType = 'signature' | 'initials' | 'date' | 'text'

export interface SigningField {
  id: string
  type: FieldType
  page: number
  x: number
  y: number
  width: number
  height: number
  assignedSignerKey: string
}

interface Signer {
  identityKey: string
  handle: string
  order: number
}

interface PdfFieldCanvasProps {
  file: File
  signers: Signer[]
  fields: SigningField[]
  onFieldsChange: (fields: SigningField[]) => void
}

const FIELD_COLORS = ['#3B82F6', '#F97316', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6']

const FIELD_ICONS: Record<FieldType, string> = {
  signature: '✍️',
  initials: '🔤',
  date: '📅',
  text: '📝',
}

const FIELD_LABELS: Record<FieldType, string> = {
  signature: 'Signature',
  initials: 'Initials',
  date: 'Date',
  text: 'Text',
}

export default function PdfFieldCanvas({ file, signers, fields, onFieldsChange }: PdfFieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.5)
  const [draggingField, setDraggingField] = useState<FieldType | null>(null)
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [selectedSignerKey, setSelectedSignerKey] = useState<string>('')
  const [isMobile, setIsMobile] = useState(false)
  const [activeFieldType, setActiveFieldType] = useState<FieldType | null>(null) // For tap-to-place on mobile
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Detect mobile on mount
  useEffect(() => {
    setIsMobile(isMobileDevice())
  }, [])

  // Load PDF using FileReader for better WebView compatibility
  useEffect(() => {
    if (!file) return

    setLoading(true)
    setPdfError(null)

    // Configure worker right before loading - must be set before getDocument()
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
    }
    console.log('[PdfFieldCanvas] Worker src:', pdfjsLib.GlobalWorkerOptions.workerSrc)

    const reader = new FileReader()
    
    reader.onload = async () => {
      try {
        const typedArray = new Uint8Array(reader.result as ArrayBuffer)
        console.log('[PdfFieldCanvas] File read, size:', typedArray.length)
        
        if (typedArray.length === 0) {
          throw new Error('File is empty')
        }
        
        const loadingTask = pdfjsLib.getDocument({ data: typedArray })
        const pdf = await loadingTask.promise
        console.log('[PdfFieldCanvas] PDF loaded, pages:', pdf.numPages)
        
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
      } catch (err) {
        console.error('[PdfFieldCanvas] PDF load error:', err)
        setPdfError(err instanceof Error ? err.message : 'Failed to load PDF')
      } finally {
        setLoading(false)
      }
    }
    
    reader.onerror = () => {
      console.error('[PdfFieldCanvas] FileReader error:', reader.error)
      setPdfError('Failed to read file')
      setLoading(false)
    }
    
    reader.readAsArrayBuffer(file)
  }, [file])

  // Set default signer when signers change
  useEffect(() => {
    if (signers.length > 0 && !selectedSignerKey) {
      setSelectedSignerKey(signers[0].identityKey)
    }
  }, [signers, selectedSignerKey])

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return

    const renderPage = async () => {
      const page = await pdfDoc.getPage(currentPage)
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current!
      const context = canvas.getContext('2d')!

      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({
        canvasContext: context,
        viewport,
        canvas,
      }).promise

      // Draw fields on this page
      drawFields(context, viewport.width, viewport.height)
    }

    renderPage()
  }, [pdfDoc, currentPage, scale, fields, selectedField])

  const drawFields = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) => {
    fields
      .filter((f) => f.page === currentPage)
      .forEach((field) => {
        const signerIndex = signers.findIndex((s) => s.identityKey === field.assignedSignerKey)
        const color = FIELD_COLORS[signerIndex % FIELD_COLORS.length]

        ctx.strokeStyle = color
        ctx.lineWidth = selectedField === field.id ? 3 : 2
        ctx.fillStyle = color + '20'

        const x = (field.x * canvasWidth) / 100
        const y = (field.y * canvasHeight) / 100
        const width = (field.width * canvasWidth) / 100
        const height = (field.height * canvasHeight) / 100

        ctx.fillRect(x, y, width, height)
        ctx.strokeRect(x, y, width, height)

        // Draw field type label
        ctx.fillStyle = color
        ctx.font = '12px system-ui, -apple-system, sans-serif'
        ctx.fillText(FIELD_LABELS[field.type as FieldType], x + 4, y + height / 2 + 4)
      })
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    // Check if clicking on existing field
    const clickedField = fields
      .filter((f) => f.page === currentPage)
      .find((f) => {
        return x >= f.x && x <= f.x + f.width && y >= f.y && y <= f.y + f.height
      })

    if (clickedField) {
      setSelectedField(clickedField.id)
      setActiveFieldType(null) // Deselect field type when selecting existing field
    } else if (isMobile && activeFieldType && selectedSignerKey) {
      // Mobile tap-to-place: if a field type is selected, place it here
      const newField: SigningField = {
        id: `field-${Date.now()}-${Math.random()}`,
        type: activeFieldType,
        page: currentPage,
        x: Math.max(0, Math.min(85, x - 7.5)),
        y: Math.max(0, Math.min(92, y - 4)),
        width: activeFieldType === 'signature' ? 25 : activeFieldType === 'initials' ? 12 : 18,
        height: 8,
        assignedSignerKey: selectedSignerKey,
      }
      onFieldsChange([...fields, newField])
      // Keep field type selected for placing multiple of same type
    } else {
      setSelectedField(null)
    }
  }

  const handleCanvasDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!draggingField || !canvasRef.current || !selectedSignerKey) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const newField: SigningField = {
      id: `field-${Date.now()}-${Math.random()}`,
      type: draggingField,
      page: currentPage,
      x: Math.max(0, Math.min(95, x - 5)),
      y: Math.max(0, Math.min(95, y - 2.5)),
      width: draggingField === 'signature' ? 20 : draggingField === 'initials' ? 10 : 15,
      height: 5,
      assignedSignerKey: selectedSignerKey,
    }

    onFieldsChange([...fields, newField])
    setDraggingField(null)
  }

  const handleDeleteField = () => {
    if (!selectedField) return
    onFieldsChange(fields.filter((f) => f.id !== selectedField))
    setSelectedField(null)
  }

  const getSignerColor = (identityKey: string) => {
    const index = signers.findIndex((s) => s.identityKey === identityKey)
    return FIELD_COLORS[index % FIELD_COLORS.length]
  }

  return (
    <div className={`${isMobile ? 'flex flex-col' : 'flex'} gap-4 h-full`}>
      {/* Sidebar */}
      <div className={`${isMobile ? 'w-full' : 'w-64'} flex-shrink-0 space-y-4`}>
        {/* Signer selector */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Assign fields to:</label>
          <div className="space-y-1.5">
            {signers.map((signer) => (
              <button
                key={signer.identityKey}
                onClick={() => setSelectedSignerKey(signer.identityKey)}
                className={`w-full text-left px-3 py-2 rounded-lg border-2 transition-colors ${
                  selectedSignerKey === signer.identityKey
                    ? 'border-current bg-opacity-10'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={{
                  borderColor:
                    selectedSignerKey === signer.identityKey ? getSignerColor(signer.identityKey) : undefined,
                  backgroundColor:
                    selectedSignerKey === signer.identityKey
                      ? getSignerColor(signer.identityKey) + '15'
                      : undefined,
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: getSignerColor(signer.identityKey) }}
                  >
                    {signer.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    {signer.handle && <p className="text-sm font-medium text-gray-800 truncate">{signer.handle}</p>}
                    {!signer.handle && signer.order === 1 && (
                      <p className="text-sm font-medium text-gray-800">You</p>
                    )}
                    {!signer.handle && signer.order !== 1 && (
                      <p className="text-xs font-mono text-gray-500 truncate">{signer.identityKey.slice(0, 12)}...</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Field palette */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            {isMobile ? 'Tap field, then tap PDF:' : 'Drag fields onto PDF:'}
          </label>
          <div className="space-y-2">
            {(['signature', 'initials', 'date', 'text'] as FieldType[]).map((type) => (
              <div
                key={type}
                draggable={!isMobile}
                onDragStart={() => !isMobile && setDraggingField(type)}
                onDragEnd={() => !isMobile && setDraggingField(null)}
                onClick={() => isMobile && setActiveFieldType(activeFieldType === type ? null : type)}
                className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg transition-colors ${
                  isMobile ? 'cursor-pointer' : 'cursor-move'
                } ${
                  activeFieldType === type
                    ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                }`}
              >
                <span className="text-lg">{FIELD_ICONS[type]}</span>
                <span className="text-sm font-medium text-gray-700">{FIELD_LABELS[type]}</span>
                {isMobile && activeFieldType === type && (
                  <span className="ml-auto text-xs text-blue-600 font-medium">Selected</span>
                )}
              </div>
            ))}
          </div>
          {isMobile && activeFieldType && (
            <p className="text-xs text-blue-600 mt-2">
              Tap anywhere on the PDF to place a {FIELD_LABELS[activeFieldType]} field
            </p>
          )}
        </div>

        {/* Delete button */}
        {selectedField && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <button
              onClick={handleDeleteField}
              className="w-full px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
            >
              Delete Selected Field
            </button>
          </div>
        )}
      </div>

      {/* PDF Canvas */}
      <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden" ref={containerRef}>
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-gray-100 rounded text-sm font-medium disabled:opacity-40 hover:bg-gray-200 transition-colors"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {numPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage === numPages}
              className="px-3 py-1.5 bg-gray-100 rounded text-sm font-medium disabled:opacity-40 hover:bg-gray-200 transition-colors"
            >
              Next →
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
              className="px-3 py-1.5 bg-gray-100 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              −
            </button>
            <span className="text-sm text-gray-600 w-12 text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(3, s + 0.25))}
              className="px-3 py-1.5 bg-gray-100 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              +
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-8 overflow-auto h-[calc(100%-57px)] flex items-start justify-center">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">Loading PDF...</p>
            </div>
          )}
          {pdfError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md text-center">
              <p className="text-red-700 font-medium mb-1">Failed to load PDF</p>
              <p className="text-red-600 text-sm">{pdfError}</p>
              <p className="text-gray-500 text-xs mt-2">Try a different PDF or use a desktop browser</p>
            </div>
          )}
          {!loading && !pdfError && (
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onDrop={handleCanvasDrop}
              onDragOver={(e) => e.preventDefault()}
              className="shadow-lg cursor-crosshair"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
