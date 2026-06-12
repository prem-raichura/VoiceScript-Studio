import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Check, FileText, Languages, Clock, Zap, Sparkles, Download } from 'lucide-react'

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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
        copied
          ? 'bg-green-50 text-green-600 border border-green-200'
          : 'bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100'
      }`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied!' : 'Copy'}
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
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-violet-200 bg-white text-[10px] font-bold text-violet-600 hover:bg-violet-50 hover:border-violet-300 transition-all active:scale-95"
        >
          <Download size={9} />
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
  return withoutMarkers
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function Panel({ icon: Icon, label, text, loading, loadingLabel, accent, onExport }) {
  const scrollRef = useRef(null)
  const paragraphs = useMemo(() => normalizeParagraphText(text), [text])
  const normalizedText = useMemo(() => paragraphs.join('\n\n'), [paragraphs])

  useEffect(() => {
    if (!scrollRef.current || !paragraphs.length) return
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [paragraphs, loading])

  return (
    <section className={`rounded-2xl border p-4 sm:p-5 transition-all duration-500 ${
      accent
        ? 'bg-gradient-to-br from-violet-50/70 to-pink-50/40 border-violet-200/60'
        : 'bg-white/70 border-white/80'
    } backdrop-blur-sm shadow-sm`}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
          accent ? 'text-violet-600' : 'text-slate-500'
        }`}>
          <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${
            accent
              ? 'bg-gradient-to-br from-violet-500 to-pink-500'
              : 'bg-gradient-to-br from-slate-400 to-slate-500'
          }`}>
            <Icon size={11} className="text-white" />
          </div>
          {label}
        </div>
        <div className="flex items-center gap-2">
          {normalizedText && onExport ? <ExportButtons onExport={onExport} /> : null}
          {normalizedText ? <CopyButton text={normalizedText} /> : null}
        </div>
      </div>

      {/* Loading dots */}
      {!normalizedText && loading ? (
        <div className="flex items-center gap-2 py-2">
          <div className="w-2 h-2 rounded-full bg-violet-400 dot-1" />
          <div className="w-2 h-2 rounded-full bg-pink-400 dot-2" />
          <div className="w-2 h-2 rounded-full bg-violet-400 dot-3" />
          <span className="text-xs font-semibold text-violet-500 ml-1">{loadingLabel}</span>
        </div>
      ) : null}

      {/* Text content */}
      {normalizedText ? (
        <div ref={scrollRef} className="max-h-72 sm:max-h-80 overflow-y-auto pr-1 scrollbar-thin">
          <div className="space-y-2">
            {paragraphs.map((paragraph, i) => {
              const isLast = i === paragraphs.length - 1
              return (
                <p
                  key={`${label}-${i}`}
                  className={`text-sm leading-6 whitespace-pre-wrap px-3 py-2 rounded-xl transition-all duration-300 ${
                    accent ? 'text-slate-700' : 'text-slate-800'
                  } ${loading && isLast ? 'bg-violet-50/60 border border-violet-200/60' : 'bg-white/50'}`}
                >
                  {paragraph}
                  {loading && isLast ? (
                    <span className="inline-block w-0.5 h-[1em] bg-violet-500 ml-0.5 align-middle animate-pulse" />
                  ) : null}
                </p>
              )
            })}
          </div>
        </div>
      ) : !loading ? (
        <p className="text-xs text-slate-400 italic py-1">Output will appear here…</p>
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
  action,
  pipelineStep,
  onExportOriginal,
  onExportTranslation,
}) {
  const isEmpty = !original && !translation && !loading

  return (
    <div className="space-y-4">
      {/* Loading progress bar */}
      {loading ? (
        <div className="rounded-2xl border border-violet-200/60 bg-white/80 backdrop-blur-sm px-5 py-4 animate-fade-up shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-sm font-bold text-violet-700">{status}</span>
            <Zap size={14} className="text-pink-400 ml-auto animate-pulse" />
          </div>
          <div className="h-2 rounded-full bg-violet-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 relative overflow-hidden transition-all duration-700"
              style={{ width: translation ? '92%' : original ? '64%' : '32%' }}
            >
              <div className="absolute inset-0 bg-white/30 animate-shimmer-bar" />
            </div>
          </div>
        </div>
      ) : null}

      {/* Meta tags */}
      {(duration > 0 || detectedLang || sourceLabel) ? (
        <div className="flex items-center gap-2 flex-wrap px-1">
          {sourceLabel ? (
            <span className="tag">
              <FileText size={10} /> {sourceLabel}
            </span>
          ) : null}
          {duration > 0 ? (
            <span className="tag">
              <Clock size={10} /> {duration}s
            </span>
          ) : null}
          {detectedLang ? (
            <span className="tag">
              <Sparkles size={10} /> {detectedLang}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Transcript panel */}
      <Panel
        icon={FileText}
        label="Transcript"
        text={original}
        loading={loading && pipelineStep === 'transcribe' && !original}
        loadingLabel="Transcribing…"
        onExport={onExportOriginal}
      />

      {/* Translation panel */}
      {action !== 'transcript' ? (
        <Panel
          icon={Languages}
          label="Translation"
          text={translation}
          loading={loading && action === 'translate' && pipelineStep === 'translate'}
          loadingLabel="Translating…"
          accent
          onExport={onExportTranslation}
        />
      ) : null}

      {/* Empty state */}
      {isEmpty ? (
        <div className="text-center py-14 animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 border border-violet-200/60 flex items-center justify-center mx-auto mb-4 shadow-md shadow-violet-100 animate-float">
            <FileText size={26} className="text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Upload an audio file to begin</p>
          <p className="text-xs text-slate-400 mt-1.5">Transcript and translation will stream here</p>
        </div>
      ) : null}
    </div>
  )
}
