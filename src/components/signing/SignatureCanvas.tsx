'use client'

import { useRef, useState, useEffect, type MouseEvent, type TouchEvent } from 'react'

interface SignatureCanvasProps {
  onSave: (dataUrl: string) => void
  onCancel: () => void
  type: 'signature' | 'initials'
}

export function SignatureCanvas({ onSave, onCancel, type }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size for good quality on mobile
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)

    // Set drawing style
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function getCoordinates(e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  function startDrawing(e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const coords = getCoordinates(e)
    if (!coords) return

    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
  }

  function draw(e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!isDrawing) return

    const coords = getCoordinates(e)
    if (!coords) return

    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
    setIsEmpty(false)
  }

  function stopDrawing() {
    setIsDrawing(false)
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
  }

  function save() {
    const canvas = canvasRef.current
    if (!canvas || isEmpty) return

    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md space-y-4 p-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {type === 'signature' ? 'Sign Here' : 'Initials Here'}
          </h3>
          <p className="text-sm text-gray-500">Draw your {type} below</p>
        </div>

        <div className="border-2 border-gray-300 rounded-lg bg-white overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-48 touch-none cursor-crosshair"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={clear}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            Clear
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={isEmpty}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
