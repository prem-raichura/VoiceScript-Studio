import { useEffect, useRef, useState } from 'react'
import { Upload, X, CheckCircle2, AlertCircle, Server, Loader2, FileAudio } from 'lucide-react'
import { toast } from 'react-hot-toast'

const MAX_MB = 1228
const CHUNK_SIZE = 4 * 1024 * 1024
const UPLOAD_CONCURRENCY = 4
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

async function uploadToServer(file, onProgress) {
  const initRes = await fetch(`${API_BASE}/api/upload-init`, { method: 'POST' })
  if (!initRes.ok) throw new Error(`Server init failed (${initRes.status})`)
  const { session_id } = await initRes.json()
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
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
  const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, totalChunks) }, () => worker())
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
    if (f.size > MAX_MB * 1024 * 1024) return 'File too large. Max 1.2 GB.'
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
      toast.success('File uploaded — ready to process!')
      onAudioReady(f, f.name, `session://${sessionId}`)
    } catch (e) {
      setUploading(false)
      setUploadStatus('')
      setFile(null)
      setUploadProgress(0)
      const msg = e.message || 'Upload failed. Try again.'
      setError(msg)
      toast.error(msg.slice(0, 80))
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
    <div className="space-y-3 w-full">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && !uploading && inputRef.current.click()}
        className={[
          'relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer',
          'flex flex-col items-center justify-center gap-4 py-10 px-6 text-center select-none min-h-[180px]',
          disabled || uploading ? 'opacity-60 cursor-not-allowed pointer-events-none' : '',
          dragging
            ? 'border-violet-400 bg-violet-50/80 scale-[1.02] shadow-lg shadow-violet-100'
            : file && !uploading
            ? 'border-green-400/50 bg-gradient-to-br from-green-50 to-emerald-50/60'
            : uploading
            ? 'border-violet-400/40 bg-gradient-to-br from-violet-50 to-pink-50/40'
            : 'border-violet-300/40 bg-gradient-to-br from-white/80 to-violet-50/30 hover:border-violet-400/60 hover:bg-violet-50/40 hover:scale-[1.01]',
        ].join(' ')}
      >
        {/* Uploading */}
        {uploading ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center">
              <Server size={26} className="text-violet-500 animate-pulse" />
            </div>
            <div className="space-y-2.5 w-full max-w-[240px]">
              <p className="font-bold text-sm text-slate-700">{uploadStatus}</p>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {file ? `${formatSize(Math.round(file.size * uploadProgress / 100))} / ${formatSize(file.size)}` : ''}
              </p>
            </div>
          </>
        ) : file ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center animate-scale-in shadow-md shadow-green-100">
              <CheckCircle2 size={28} className="text-green-500" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-sm text-slate-800 truncate max-w-[220px]">{file.name}</p>
              <p className="text-xs text-slate-400 font-medium">{formatSize(file.size)} · Ready to process</p>
            </div>
            <button
              onClick={clear}
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center bg-white/80 border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all duration-150 shadow-sm"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <>
            <div className={[
              'w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md',
              dragging
                ? 'bg-gradient-to-br from-violet-500 to-pink-500 text-white scale-110'
                : 'bg-gradient-to-br from-violet-100 to-pink-100 text-violet-500'
            ].join(' ')}>
              <Upload size={24} className={dragging ? 'animate-bounce' : ''} />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-700">
                {dragging ? 'Drop your file here!' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-slate-400 mt-1.5 font-medium">MP3, WAV, M4A, OGG, WebM · up to 1.2 GB</p>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 px-3 py-2 rounded-xl bg-red-50 border border-red-100 animate-scale-in font-medium">
          <AlertCircle size={13} className="flex-shrink-0" /> {error}
        </div>
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
