'use client'

import { useState } from 'react'
import { Upload, X, File } from 'lucide-react'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  accepted?: string[]
  maxSize?: number
}

export function FileUpload({
  onFileSelect,
  accepted = ['.pdf', '.jpg', '.png'],
  maxSize = 10 * 1024 * 1024,
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string>('')
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileChange = (selectedFile: File) => {
    setError('')

    const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase()
    if (!accepted.includes(ext)) {
      setError(`File type not supported. Accepted: ${accepted.join(', ')}`)
      return
    }

    if (selectedFile.size > maxSize) {
      setError(`File too large. Maximum: ${(maxSize / 1024 / 1024).toFixed(0)}MB`)
      return
    }

    setFile(selectedFile)
    onFileSelect(selectedFile)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileChange(droppedFile)
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={() => setIsDragOver(true)}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          isDragOver
            ? 'border-[var(--primary)] bg-[var(--primary)]/5'
            : 'border-[var(--border)] hover:border-[var(--primary)]'
        }`}
      >
        <label className="cursor-pointer">
          <Upload className="mx-auto h-8 w-8 text-[var(--text-muted)] mb-2" />
          <p className="text-sm font-medium text-[var(--text)]">
            Drag and drop your file here
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            or click to browse
          </p>
          <input
            type="file"
            className="hidden"
            accept={accepted.join(',')}
            onChange={e => {
              if (e.target.files?.[0]) {
                handleFileChange(e.target.files[0])
              }
            }}
          />
        </label>
      </div>

      {file && (
        <div className="flex items-center justify-between bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg p-3">
          <div className="flex items-center gap-2">
            <File className="h-4 w-4 text-[var(--primary)]" />
            <div className="text-sm">
              <p className="font-medium text-[var(--text)]">{file.name}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setFile(null)
              setError('')
            }}
            className="p-1 hover:bg-[var(--border)] rounded transition-colors"
          >
            <X className="h-4 w-4 text-[var(--text-muted)]" />
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-[var(--bad)]">{error}</p>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        Upload your premises or wholesale dealer licence issued by your national authority. This is reviewed before your account is activated.
      </p>
    </div>
  )
}
