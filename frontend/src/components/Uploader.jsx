import { useEffect, useRef, useState } from 'react'
import { Upload, X, CheckCircle2, AlertCircle, Server, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

const MAX_MB = 1228
const CHUNK_SIZE = 4 * 1024 * 1024 // 4 MB per chunk
const UPLOAD_CONCURRENCY = 4 // parallel chunk uploads — much faster than sequential
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

async function uploadOneChunk(sessionId, file, totalChunks, index) {
  const start = index * CHUNK_SIZE
  const end = Math.min(start + CHUNK_SIZE, file.size)
  const chunk = file.slice(start, end)

  const fd = new FormData()
  fd.append('session_id', sessionId)
  fd.append('chunk_index', String(index))
  fd.append('total_chunks', String(totalChunks))
  fd.append('chunk', chunk, file.name)

  const res = await fetch(`${API_BASE}/api/upload-chunk`, { method: 'POST', body: fd })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Chunk ${index + 1} upload failed (${res.status})`)
  }
}

/**
 * Uploads a file to the Render backend in 4 MB chunks.
 * 1. POST /api/upload-init   → gets session_id (also wakes Render)
 * 2. POST /api/upload-chunk  × N  → sends slices with limited concurrency
 * Chunks carry their own index, so order of arrival does not matter.
 * Returns session_id on success.
 */
async function uploadToServer(file, onProgress) {
  // Step 1 — init session (wakes Render if sleeping)
  const initRes = await fetch(`${API_BASE}/api/upload-init`, { method: 'POST' })
  if (!initRes.ok) throw new Error(`Server init failed (${initRes.status})`)
  const { session_id } = await initRes.json()

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  console.log(`[upload] session=${session_id} chunks=${totalChunks} file=${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`)

  // Step 2 — upload chunks with a bounded concurrency pool
  let nextIndex = 0
  let completed = 0

  const worker = async () => {
    while (nextIndex < totalChunks) {
      const index = nextIndex++
      await uploadOneChunk(session_id, file, totalChunks, index)
      completed++
      onProgress(Math.round((completed / totalChunks) * 100))
    }
  }

  const workers = Array.from(
    { length: Math.min(UPLOAD_CONCURRENCY, totalChunks) },
    () => worker(),
  )
  await Promise.all(workers)

  return session_id
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
    if (f.size > MAX_MB * 1024 * 1024) return `File too large. Max 1.2 GB.`
    return null
  }

  async function handleFile(f) {
    const err = validate(f)
    if (err) { setError(err); return }
    setError('')
    setFile(f)
    setUploading(true)
    setUploadProgress(0)
    setUploadStatus('Connecting to server…')

    try {
      const sessionId = await uploadToServer(f, (pct) => {
        setUploadProgress(pct)
        setUploadStatus(`Uploading… ${pct}%`)
      })
      setUploading(false)
      setUploadStatus('')
      toast.success(`File uploaded — ready to process!`)
      // Pass session:// ref as the cloudinary URL slot — App.jsx routes accordingly
      onAudioReady(f, f.name, `session://${sessionId}`)
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
            ? 'border-mud-base bg-mud-light scale-[1.02]'
            : file && !uploading
              ? 'border-green-500/30 bg-gradient-to-br from-green-50 to-emerald-50'
              : uploading
                ? 'border-mud-base/40 bg-gradient-to-br from-stone-50 to-stone-400'
                : 'border-mud-base/30 bg-gradient-to-br from-white to-brand-50/40 hover:border-mud-base hover:from-brand-50 hover:to-stone-50 hover:scale-[1.01]'}`}
      >
        {/* ── Uploading state ── */}
        {uploading ? (
          <>
            <div className="w-10 h-10 rounded-xl bg-mud-dark/10 flex items-center justify-center">
              <Server size={20} className="text-mud-dark animate-pulse" />
            </div>
            <div className="animate-fade-in space-y-2 w-full max-w-[220px]">
              <p className="font-semibold text-sm text-mud-dark">{uploadStatus}</p>
              <div className="w-full bg-mud-light rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-mud-dark rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-mud-light0">
                {file ? `${formatSize(Math.round(file.size * uploadProgress / 100))} / ${formatSize(file.size)}` : ''}
              </p>
            </div>
          </>
        ) : file ? (
          <>
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-mud-moss/20 flex items-center justify-center animate-scale-in">
                <CheckCircle2 size={22} className="text-mud-moss" />
              </div>
            </div>
            <div className="animate-fade-in space-y-1">
              <p className="font-semibold text-sm text-mud-dark truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-mud-light0">{formatSize(file.size)} · Ready to process</p>
            </div>
            <button
              onClick={clear}
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center
                         text-mud-dark/90 hover:text-mud-dark/90 hover:bg-mud-light transition-all duration-150"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <div className={`w-9 h-9 flex items-center justify-center transition-all duration-300
              ${dragging
                ? 'text-mud-dark/90 scale-110'
                : 'text-mud-dark'}`}>
              <Upload size={22} strokeWidth={1.75} className={dragging ? 'animate-bounce' : ''} />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[13px] text-mud-dark leading-snug">
                {dragging ? 'Drop your audio file here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-[11px] text-mud-dark/50 leading-snug">MP3, WAV, M4A, OGG, WebM · up to 1.2 GB</p>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-mud-clay px-2 py-1.5 rounded-lg bg-mud-clay/20 border border-mud-clay/20 animate-fade-in flex items-center gap-1.5">
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