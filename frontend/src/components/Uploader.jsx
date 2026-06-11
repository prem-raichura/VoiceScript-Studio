import { useEffect, useRef, useState } from 'react'
import { Upload, X, CheckCircle2, AlertCircle, Cloud, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

const MAX_MB = 1228
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const USE_CLOUDINARY = Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET)

/**
 * Uploads a file to Cloudinary using their chunked upload API.
 * Sends 6 MB slices with Content-Range + X-Unique-Upload-Id headers.
 * Each chunk is way under any preset limit — no 413 errors.
 * Works for files of any size on the free tier.
 */
async function uploadToCloudinary(file, onProgress) {
  const CHUNK_SIZE = 6 * 1024 * 1024 // 6 MB per chunk
  const totalSize = file.size
  const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`

  console.log('[Cloudinary] Chunked upload →', endpoint)
  console.log('[Cloudinary] Preset:', CLOUDINARY_UPLOAD_PRESET, '| File:', file.name, `(${(totalSize / 1024 / 1024).toFixed(1)} MB)`)

  let start = 0
  let secureUrl = null

  while (start < totalSize) {
    const end = Math.min(start + CHUNK_SIZE, totalSize)
    const chunk = file.slice(start, end)

    const fd = new FormData()
    fd.append('file', chunk, file.name)
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-Unique-Upload-Id': uniqueId,
        'Content-Range': `bytes ${start}-${end - 1}/${totalSize}`,
      },
      body: fd,
    })

    let body = {}
    try { body = await res.json() } catch { /* ignore */ }

    if (!res.ok) {
      const msg = body?.error?.message || `Cloudinary error ${res.status}`
      console.error('[Cloudinary] Chunk error:', res.status, body)
      throw new Error(msg)
    }

    // Cloudinary returns secure_url only on the final chunk
    if (body.secure_url) secureUrl = body.secure_url

    onProgress(Math.round((end / totalSize) * 100))
    start = end
  }

  if (!secureUrl) throw new Error('Cloudinary upload completed but no URL returned')
  console.log('[Cloudinary] Upload complete:', secureUrl)
  return secureUrl
}


export default function Uploader({ onAudioReady, disabled, selectedFile, onClearSelected }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

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

    // ── Cloudinary upload path (production on Render) ─────────────────────────
    if (USE_CLOUDINARY) {
      setUploading(true)
      setUploadProgress(0)
      try {
        const cloudUrl = await uploadToCloudinary(f, setUploadProgress)
        setUploading(false)
        toast.success('File uploaded to cloud — ready to process!')
        onAudioReady(f, f.name, cloudUrl)
      } catch (e) {
        setUploading(false)
        setError(e.message || 'Cloud upload failed. Try again.')
        toast.error(e.message?.slice(0, 80) || 'Cloud upload failed.')
        setFile(null)
      }
      return
    }

    // ── Direct path (local dev, no Cloudinary configured) ─────────────────────
    onAudioReady(f, f.name, null)
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
    if (onClearSelected) onClearSelected()
  }

  const formatSize = b => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && !uploading && inputRef.current.click()}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
          flex flex-col items-center justify-center gap-3 py-10 px-6 text-center select-none
          ${disabled || uploading ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}
          ${dragging
            ? 'border-brand-400 bg-slate-50 scale-[1.02]'
            : file && !uploading
            ? 'border-green-500/30 bg-gradient-to-br from-green-50 to-emerald-50'
            : uploading
            ? 'border-indigo-400/40 bg-gradient-to-br from-indigo-50 to-violet-50'
            : 'border-brand-500/30 bg-gradient-to-br from-white to-brand-50/40 hover:border-brand-400 hover:from-brand-50 hover:to-indigo-50 hover:scale-[1.01]'}`}
      >
        {/* ── Uploading state ── */}
        {uploading ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Cloud size={26} className="text-indigo-500 animate-pulse" />
            </div>
            <div className="animate-fade-in space-y-2 w-full max-w-[200px]">
              <p className="font-semibold text-sm text-slate-800">Uploading to cloud…</p>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">{uploadProgress}%</p>
            </div>
          </>
        ) : file ? (
          <>
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center animate-scale-in">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
            </div>
            <div className="animate-fade-in space-y-1">
              <p className="font-semibold text-sm text-slate-800 truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-slate-500">
                {formatSize(file.size)} {USE_CLOUDINARY ? '· Uploaded to cloud ☁️' : '· Ready to process'}
              </p>
            </div>
            <button
              onClick={clear}
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center
                         text-slate-700 hover:text-slate-700 hover:bg-white/80 transition-all duration-150"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300
              ${dragging
                ? 'bg-slate-500 text-slate-900 scale-110 shadow-brand'
                : 'bg-slate-50 text-indigo-600 group-hover:bg-indigo-500/10'}`}>
              <Upload size={22} className={dragging ? 'animate-bounce' : ''} />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-800">
                {dragging ? 'Drop your audio file here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-slate-500 mt-1.5">MP3, WAV, M4A, OGG, WebM · up to 1.2 GB</p>
              {USE_CLOUDINARY && (
                <p className="text-[10px] text-indigo-400 mt-1 flex items-center justify-center gap-1">
                  <Cloud size={10} /> Uploaded securely via Cloudinary
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 px-2 py-1.5 rounded-lg bg-red-50 border border-red-500/20 animate-fade-in flex items-center gap-1.5">
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
