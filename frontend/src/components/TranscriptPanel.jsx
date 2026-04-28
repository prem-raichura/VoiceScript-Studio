import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Check, FileText, Languages, Clock, Zap, Sparkles } from 'lucide-react'

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={copy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 active:scale-95 ${
        copied
          ? 'bg-green-100 text-green-700 border border-green-200'
          : 'bg-brand-50 text-brand-500 border border-brand-100 hover:bg-brand-100'
      }`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function ExportButtons({ onExport }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {['TXT', 'DOC', 'PDF', 'JSON'].map((format) => (
        <button
          key={format}
          onClick={() => onExport(format.toLowerCase())}
          className="px-2 py-1 rounded-md border border-brand-100 bg-white/80 text-[10px] font-semibold text-brand-500 hover:bg-brand-50 transition-colors"
        >
          {format}
        </button>
      ))}
    </div>
  )
}

function normalizeParagraphText(text = '') {
  const clean = String(text || '').replaceAll('\r\n', '\n').trim()
  if (!clean) return []
  const withoutMarkers = clean
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]+|\d+[.)])\s+/, '').trimEnd())
    .join('\n')
  const paragraphs = withoutMarkers
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return paragraphs
}

function Panel({ icon: Icon, label, text, loading, loadingLabel, accent, onExport }) {
  const scrollRef = useRef(null)
  const paragraphs = useMemo(() => normalizeParagraphText(text), [text])
  const normalizedText = useMemo(() => paragraphs.join('\n\n'), [paragraphs])
  const accentClasses = accent
    ? 'bg-gradient-to-br from-brand-50 to-cyan-50 border-brand-200'
    : 'bg-gradient-to-br from-slate-50 to-sky-50 border-slate-200'
  const labelColor = accent ? 'text-brand-600' : 'text-slate-500'
  const textColor = accent ? 'text-brand-900' : 'text-slate-800'

  useEffect(() => {
    if (!scrollRef.current || !paragraphs.length) return
    const el = scrollRef.current
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [paragraphs, loading])

  return (
    <section className={`rounded-2xl border p-5 transition-all duration-500 animate-slide-up ${accentClasses}`}>
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${labelColor}`}>
          <Icon size={12} />
          <span>{label}</span>
        </div>
        {normalizedText ? <CopyButton text={normalizedText} /> : null}
      </div>

      {normalizedText && onExport ? (
        <div className="mb-3">
          <ExportButtons onExport={onExport} />
        </div>
      ) : null}

      {!normalizedText && loading ? (
        <div className="flex items-center gap-2 py-1">
          <div className="w-2 h-2 rounded-full bg-brand-400 dot-1" />
          <div className="w-2 h-2 rounded-full bg-brand-400 dot-2" />
          <div className="w-2 h-2 rounded-full bg-brand-400 dot-3" />
          <span className="text-xs font-medium text-brand-500">{loadingLabel}</span>
        </div>
      ) : null}

      {normalizedText ? (
        <div ref={scrollRef} className="max-h-80 overflow-y-auto pr-1 scrollbar-thin">
          <div className="space-y-2">
            {paragraphs.map((paragraph, i) => {
              const isLast = i === paragraphs.length - 1
              return (
                <p
                  key={`${label}-${i}-${paragraph.slice(0, 16)}`}
                  className={`text-sm leading-6 font-mono whitespace-pre-wrap px-2.5 py-1.5 rounded-lg transition-all duration-300 ${textColor} ${
                    loading && isLast ? 'bg-brand-100/70 border border-brand-200' : ''
                  }`}
                >
                  <span>{paragraph}</span>
                  {loading && isLast ? <span className="inline-block w-0.5 h-[1em] bg-brand-500 ml-0.5 align-middle animate-typing" /> : null}
                </p>
              )
            })}
          </div>
        </div>
      ) : !loading ? (
        <p className="text-xs text-slate-400 italic">Output will appear here...</p>
      ) : null}
    </section>
  )
}

export default function TranscriptPanel({
  original,
  translation,
  loading,
  status,
  duration,
  detectedLang,
  sourceLabel,
  onExportOriginal,
  onExportTranslation,
}) {
  const isEmpty = !original && !translation && !loading

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="rounded-2xl border border-brand-100 bg-white px-5 py-4 animate-fade-in shadow-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-5 h-5 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin flex-shrink-0" />
            <span className="text-sm font-semibold text-brand-600">{status}</span>
            <Zap size={14} className="text-brand-300 ml-auto animate-pulse" />
          </div>
          <div className="h-1.5 rounded-full bg-brand-50 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-500 relative overflow-hidden"
              style={{ width: translation ? '92%' : original ? '64%' : '32%', transition: 'width 0.6s ease' }}
            >
              <div className="absolute inset-0 bg-white/25 animate-progress" />
            </div>
          </div>
        </div>
      ) : null}

      {(duration > 0 || detectedLang || sourceLabel) ? (
        <div className="flex items-center gap-2 px-1 animate-slide-up flex-wrap">
          {sourceLabel ? (
            <span className="tag bg-cyan-50 text-cyan-700 border border-cyan-100">
              <FileText size={10} /> Source: {sourceLabel}
            </span>
          ) : null}
          {duration > 0 ? (
            <span className="tag bg-brand-50 text-brand-600 border border-brand-100">
              <Clock size={10} /> {duration}s
            </span>
          ) : null}
          {detectedLang ? (
            <span className="tag bg-sky-50 text-sky-700 border border-sky-100">
              <Sparkles size={10} /> Detected: {detectedLang}
            </span>
          ) : null}
        </div>
      ) : null}

      <Panel
        icon={FileText}
        label="Transcript"
        text={original}
        loading={loading && !original}
        loadingLabel="Transcribing..."
        onExport={onExportOriginal}
      />
      <Panel
        icon={Languages}
        label="Translation"
        text={translation}
        loading={loading}
        loadingLabel="Translating..."
        accent
        onExport={onExportTranslation}
      />

      {isEmpty ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-4 animate-float">
            <FileText size={24} className="text-brand-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">Upload audio or paste a source URL to begin</p>
          <p className="text-xs text-slate-400 mt-1">Transcript and translation will stream here in readable paragraph form</p>
        </div>
      ) : null}
    </div>
  )
}
