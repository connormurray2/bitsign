'use client'

import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Use local worker for WebView compatibility
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

interface PDFWithFieldsProps {
  url: string
  fields: SigningField[]
}

export function PDFWithFields({ url, fields }: PDFWithFieldsProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageWidth, setPageWidth] = useState(600)

  // Group fields by page
  const fieldsByPage = fields.reduce((acc, field) => {
    if (!acc[field.page]) acc[field.page] = []
    acc[field.page].push(field)
    return acc
  }, {} as Record<number, SigningField[]>)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
      <Document
        file={url}
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
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
          <div key={pageNum} className="mb-4 last:mb-0">
            <div className="relative inline-block">
              <Page
                pageNumber={pageNum}
                width={pageWidth}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                onLoadSuccess={(page) => {
                  // Adjust page width on first page load
                  if (pageNum === 1) {
                    const container = document.querySelector('.pdf-fields-container')
                    if (container) {
                      setPageWidth(Math.min(600, container.clientWidth - 32))
                    }
                  }
                }}
              />
              
              {/* Render completed fields as overlays */}
              {fieldsByPage[pageNum]?.filter(f => f.value).map((field) => (
                <div
                  key={field.id}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: `${field.width}%`,
                    height: `${field.height}%`,
                  }}
                >
                  {/* Signature/Initials: render the image */}
                  {(field.type === 'signature' || field.type === 'initials') && field.value && (
                    <img
                      src={field.value}
                      alt={field.type}
                      className="w-full h-full object-contain"
                      style={{ maxHeight: '100%' }}
                    />
                  )}
                  
                  {/* Date: render formatted date */}
                  {field.type === 'date' && field.value && (
                    <div className="w-full h-full flex items-center text-xs font-medium text-gray-800">
                      {new Date(field.value).toLocaleDateString()}
                    </div>
                  )}
                  
                  {/* Text: render the text value */}
                  {field.type === 'text' && field.value && (
                    <div className="w-full h-full flex items-center text-xs font-medium text-gray-800">
                      {field.value}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Page number */}
            <div className="text-center text-xs text-gray-400 mt-2">
              Page {pageNum} of {numPages}
            </div>
          </div>
        ))}
      </Document>
    </div>
  )
}
