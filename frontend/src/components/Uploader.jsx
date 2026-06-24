import { useEffect, useRef, useState } from 'react'
import { Upload, X, CheckCircle2, AlertCircle, Server } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { upload } from '@vercel/blob/client'

const MAX_MB = 1024
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

/**
 * Uploads a file straight to Vercel Blob via a client-upload token.
 * Bypasses Vercel's 4.5 MB request body cap and supports multipart up to ~1 GB.
 * Returns the public blob URL.
 */
async function uploadToBlob(file, onProgress) {
  const result = await upload(file.name, file, {
    access: 'public',
    handleUploadUrl: `${API_BASE}/api/blob/upload`,
    multipart: true,
    onUploadProgress: (e) => onProgress(Math.round(e.percentage)),
  })
  return result.url
}

export default function Uploader({ onAudioReady, disabled, selectedFile, onClearSelected }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('')

  useEffect(() => {
    setFile(selectedFile || null)
  }, [selectedFile?.name, selectedFile?.size])

  function validate(f) {
    if (!f) return 'No file selected.'
    if (f.size > MAX_MB * 1024 * 1024) return `File too large. Max 1 GB.`
    return null
  }

  async function handleFile(f) {
    const err = validate(f)
    if (err) { setError(err); return }
    setError('')
    setFile(f)
    setUploading(true)
    setUploadProgress(0)
    setUploadStatus('Uploading to storage…')

    try {
      const blobUrl = await uploadToBlob(f, (pct) => {
        setUploadProgress(pct)
        setUploadStatus(`Uploading… ${pct}%`)
      })
      setUploading(false)
      setUploadStatus('')
      toast.success(`File uploaded — ready to process!`)
      // Pass the Blob URL in the third slot — App.jsx routes on the blob:// scheme
      onAudioReady(f, f.name, blobUrl)
    } catch (e) {
      setUploading(false)
      setUploadStatus('')
      setFile(null)
      setUploadProgress(0)
      const msg = e.message || 'Upload failed. Try again.'
      setError(msg)
      toast.error(msg.slice(0, 80))
      console.error('[upload] failed:', e)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  function clear(e) {
    e.stopPropagation()
    setFile(null)
    setError('')
    setUploading(false)
    setUploadProgress(0)
    setUploadStatus('')
    if (onClearSelected) onClearSelected()
  }

  const formatSize = b => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

  return (
    <div className="h-full flex flex-col space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && !uploading && inputRef.current.click()}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
          flex flex-col items-center justify-center gap-3 flex-1 px-6 text-center select-none
          ${disabled || uploading ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}
          ${dragging
            ? 'border-teal-200 bg-slate-50 scale-[1.02]'
            : file && !uploading
              ? 'border-green-500/30 bg-gradient-to-br from-green-50 to-emerald-50'
              : uploading
                ? 'border-teal-200/40 bg-gradient-to-br from-stone-50 to-stone-400'
                : 'border-slate-200 bg-gradient-to-br from-white to-brand-50/40 hover:border-teal-200 hover:from-brand-50 hover:to-stone-50 hover:scale-[1.01]'}`}
      >
        {/* ── Uploading state ── */}
        {uploading ? (
          <>
            <div className="w-10 h-10 rounded-xl bg-slate-900/10 flex items-center justify-center">
              <Server size={20} className="text-slate-900 animate-pulse" />
            </div>
            <div className="animate-fade-in space-y-2 w-full max-w-[220px]">
              <p className="font-semibold text-sm text-slate-900">{uploadStatus}</p>
              <div className="w-full bg-slate-50 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-slate-900 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">
                {file ? `${formatSize(Math.round(file.size * uploadProgress / 100))} / ${formatSize(file.size)}` : ''}
              </p>
            </div>
          </>
        ) : file ? (
          <>
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center animate-scale-in">
                <CheckCircle2 size={22} className="text-emerald-700" />
              </div>
            </div>
            <div className="animate-fade-in space-y-1">
              <p className="font-semibold text-sm text-slate-900 truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-slate-500">{formatSize(file.size)} · Ready to process</p>
            </div>
            <button
              onClick={clear}
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center
                         text-slate-800 hover:text-slate-800 hover:bg-slate-50 transition-all duration-150"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <div className={`w-9 h-9 flex items-center justify-center transition-all duration-300
              ${dragging
                ? 'text-slate-800 scale-110'
                : 'text-slate-900'}`}>
              <Upload size={22} strokeWidth={1.75} className={dragging ? 'animate-bounce' : ''} />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[13px] text-slate-900 leading-snug">
                {dragging ? 'Drop your audio file here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-[11px] text-slate-900/50 leading-snug">MP3, WAV, M4A, OGG, WebM · up to 1 GB</p>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-600 px-2 py-1.5 rounded-lg bg-rose-50 border border-rose-200/20 animate-fade-in flex items-center gap-1.5">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }}
      />
    </div>
  )
}