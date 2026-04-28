import { useEffect, useRef, useState } from 'react'
import { Upload, X, CheckCircle2, AlertCircle } from 'lucide-react'

const MAX_MB = 1228

export default function Uploader({ onAudioReady, disabled, selectedFile, onClearSelected }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setFile(selectedFile || null)
  }, [selectedFile?.name, selectedFile?.size])

  function validate(f) {
    if (!f) return 'No file selected.'
    if (f.size > MAX_MB * 1024 * 1024) return `File too large. Max 1.2 GB.`
    return null
  }

  function handleFile(f) {
    const err = validate(f)
    if (err) { setError(err); return }
    setError('')
    setFile(f)
    onAudioReady(f, f.name)
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
    if (onClearSelected) onClearSelected()
  }

  const formatSize = b => b < 1024*1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/1024/1024).toFixed(1)} MB`

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current.click()}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
          flex flex-col items-center justify-center gap-3 py-10 px-6 text-center select-none
          ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
          ${dragging
            ? 'border-brand-400 bg-brand-50 scale-[1.02]'
            : file
            ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50'
            : 'border-brand-200 bg-gradient-to-br from-white to-brand-50/40 hover:border-brand-400 hover:from-brand-50 hover:to-indigo-50 hover:scale-[1.01]'}`}
      >
        {file ? (
          <>
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center animate-scale-in">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
            </div>
            <div className="animate-fade-in space-y-1">
              <p className="font-semibold text-sm text-gray-800 truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-gray-400">{formatSize(file.size)} - Ready to process</p>
            </div>
            <button
              onClick={clear}
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center
                         text-gray-300 hover:text-gray-600 hover:bg-white transition-all duration-150"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300
              ${dragging
                ? 'bg-brand-500 text-white scale-110 shadow-brand'
                : 'bg-brand-50 text-brand-400 group-hover:bg-brand-100'}`}>
              <Upload size={22} className={dragging ? 'animate-bounce' : ''} />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-700">
                {dragging ? 'Drop your audio file here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-gray-400 mt-1.5">MP3, WAV, M4A, OGG, WebM - up to 1.2 GB</p>
            </div>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-500 px-2 py-1.5 rounded-lg bg-red-50 border border-red-100 animate-fade-in flex items-center gap-1.5">
        <AlertCircle size={12} /> {error}
      </p>}

      <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} />
    </div>
  )
}
