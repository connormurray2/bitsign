'use client'

import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
}

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

  // Load PDF
  useEffect(() => {
    if (!file) return

    const loadPdf = async () => {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      setPdfDoc(pdf)
      setNumPages(pdf.numPages)
    }

    loadPdf()
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
    <div className="flex gap-4 h-full">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 space-y-4">
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
          <label className="block text-sm font-semibold text-gray-700 mb-3">Drag fields onto PDF:</label>
          <div className="space-y-2">
            {(['signature', 'initials', 'date', 'text'] as FieldType[]).map((type) => (
              <div
                key={type}
                draggable
                onDragStart={() => setDraggingField(type)}
                onDragEnd={() => setDraggingField(null)}
                className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-gray-300 transition-colors"
              >
                <span className="text-lg">{FIELD_ICONS[type]}</span>
                <span className="text-sm font-medium text-gray-700">{FIELD_LABELS[type]}</span>
              </div>
            ))}
          </div>
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

        <div className="p-8 overflow-auto h-[calc(100%-57px)] flex items-start justify-center">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onDrop={handleCanvasDrop}
            onDragOver={(e) => e.preventDefault()}
            className="shadow-lg cursor-crosshair"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </div>
      </div>
    </div>
  )
}
