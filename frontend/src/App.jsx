import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Languages,
  Link2,
  Loader2,
  Mic,
  RefreshCw,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react'
import Uploader from './components/Uploader'
import TranscriptPanel from './components/TranscriptPanel'
import LanguageSelector from './components/LanguageSelector'
import History from './components/History'

const LARGE_FILE_THRESHOLD_BYTES = 1 * 1024 * 1024
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const PIPELINE_STEPS = [
  { id: 'input_received', label: '1. Input Received' },
  { id: 'source_detection', label: '2. Source Detection' },
  { id: 'extraction', label: '3. Audio Extraction (if needed)' },
  { id: 'transcribe', label: '4. Transcription' },
  { id: 'translate', label: '5. Translation' },
  { id: 'output', label: '6. Output Generated' },
]

const STEP_RANK = {
  idle: 0,
  input_received: 1,
  source_detection: 2,
  extraction: 3,
  transcribe: 4,
  translate: 5,
  output: 6,
  error: 0,
}

const SOURCE_BADGES = {
  drive_audio: 'Drive Audio',
  drive_video: 'Drive Video',
  direct_audio: 'Direct Audio',
  direct_video: 'Direct Video',
}

function normalizeParagraphText(value = '') {
  const raw = String(value || '').replaceAll('\r\n', '\n').trim()
  if (!raw) return ''

  const withoutMarkers = raw
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]+|\d+[.)])\s+/, '').trimEnd())
    .join('\n')

  return withoutMarkers
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function toSafeFileStamp(date = new Date()) {
  return date.toISOString().replaceAll(':', '-').replaceAll('.', '-')
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
  toast.success(`Exported ${filename}`)
}

function parseDispositionFilename(headerValue) {
  if (!headerValue) return 'source-audio.mp3'
  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1])
  const plainMatch = headerValue.match(/filename="?([^";]+)"?/i)
  if (plainMatch?.[1]) return plainMatch[1]
  return 'source-audio.mp3'
}

function buildEntriesForAll(original, translation, history, sourceLabel) {
  const entries = []
  const currentOriginal = normalizeParagraphText(original)
  const currentTranslation = normalizeParagraphText(translation)

  if (currentOriginal || currentTranslation) {
    entries.push({
      label: 'Current output',
      timestamp: '',
      sourceLabel: sourceLabel || '',
      original: currentOriginal,
      translation: currentTranslation,
    })
  }

  history.forEach((item) => {
    entries.push({
      label: 'Previous Session',
      timestamp: item.timestamp || '',
      sourceLabel: item.sourceLabel || '',
      original: normalizeParagraphText(item.original),
      translation: normalizeParagraphText(item.translation),
    })
  })

  return entries
}

function buildExportTextReport({
  entries,
  generatedAt,
  sourceLang,
  targetLang,
  detectedLang,
  duration,
  includeOriginal = true,
  includeTranslation = true,
  sourceTypeLabel = '',
}) {
  const lines = [
    'VoiceScript - Transcript Export',
    `Generated: ${generatedAt}`,
    `Source Type: ${sourceTypeLabel || 'N/A'}`,
    `Source Language: ${sourceLang}`,
    `Target Language: ${targetLang}`,
    `Detected Language: ${detectedLang || 'N/A'}`,
    `Audio Duration: ${duration > 0 ? `${duration}s` : 'N/A'}`,
    '',
  ]

  entries.forEach((entry) => {
    const timeSuffix = entry.timestamp ? ` | ${entry.timestamp}` : ''
    const entrySource = entry.sourceLabel ? ` | ${entry.sourceLabel}` : ''
    lines.push(`${entry.label}${timeSuffix}${entrySource}`)
    if (includeOriginal) {
      lines.push('Transcript:')
      lines.push(entry.original || '[empty]')
      lines.push('')
    }
    if (includeTranslation) {
      lines.push('Translation:')
      lines.push(entry.translation || '[empty]')
      lines.push('')
    }
    lines.push('------------------------------------------------------------')
    lines.push('')
  })

  const footer = 'Developed by Prem Raichura | premraichura.me'
  lines.push('')
  lines.push(footer.padStart(Math.max(footer.length, 92)))
  return lines.join('\n')
}

function buildExportHtmlReport({
  entries,
  generatedAt,
  sourceLang,
  targetLang,
  detectedLang,
  duration,
  includeOriginal = true,
  includeTranslation = true,
  sourceTypeLabel = '',
  mode = 'doc',
}) {
  const sections = entries.map((entry) => {
    const timeSuffix = entry.timestamp ? ` <span class="muted">(${escapeHtml(entry.timestamp)})</span>` : ''
    const sourceSuffix = entry.sourceLabel ? ` <span class="muted">| ${escapeHtml(entry.sourceLabel)}</span>` : ''
    const originalParagraphs = (entry.original || '')
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join('')
    const translationParagraphs = (entry.translation || '')
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join('')
    return `
      <section class="entry">
        <h2>${escapeHtml(entry.label)}${timeSuffix}${sourceSuffix}</h2>
        ${includeOriginal ? `<h3>Transcript</h3><div class="paragraph-block">${originalParagraphs || '<p>[empty]</p>'}</div>` : ''}
        ${includeTranslation ? `<h3>Translation</h3><div class="paragraph-block">${translationParagraphs || '<p>[empty]</p>'}</div>` : ''}
      </section>
    `
  }).join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>VoiceScript Export</title>
  <style>
    body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; padding: 30px; line-height: 1.45; }
    ${mode === 'pdf' ? 'body { padding-bottom: 70px; }' : ''}
    h1 { margin: 0 0 8px; font-size: 24px; }
    .meta { color: #334155; margin: 0 0 20px; font-size: 13px; }
    .entry { border: 1px solid #dbeafe; border-radius: 12px; padding: 16px; margin-bottom: 14px; background: #f8fbff; }
    h2 { margin: 0 0 10px; font-size: 16px; color: #1d4ed8; }
    h3 { margin: 10px 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
    .paragraph-block { margin: 0; padding: 12px; border-radius: 8px; background: white; border: 1px solid #e2e8f0; font-size: 12px; }
    .paragraph-block p { margin: 0; white-space: normal; word-break: break-word; }
    .paragraph-block p + p { margin-top: 10px; }
    .muted { color: #64748b; font-size: 12px; font-weight: 400; }
    .doc-footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #dbeafe; font-size: 13px; color: #334155; text-align: right; }
    .doc-footer a { color: #E6007A; text-decoration: none; font-weight: 600; }
    .pdf-footer { font-size: 12px; color: #334155; text-align: right; }
    .pdf-footer a { color: #1d4ed8; text-decoration: none; font-weight: 600; }
    @media print {
      @page { margin: 20mm; }
      ${mode === 'pdf' ? '.pdf-footer { position: fixed; right: 24px; bottom: 12px; }' : ''}
    }
  </style>
</head>
<body>
  <h1>VoiceScript Export</h1>
  <p class="meta">
    Generated: ${escapeHtml(generatedAt)}<br/>
    Source Type: ${escapeHtml(sourceTypeLabel || 'N/A')}<br/>
    Source Language: ${escapeHtml(sourceLang)} | Target Language: ${escapeHtml(targetLang)}<br/>
    Detected Language: ${escapeHtml(detectedLang || 'N/A')} | Duration: ${escapeHtml(duration > 0 ? `${duration}s` : 'N/A')}
  </p>
  ${sections}
  ${mode === 'pdf'
      ? '<div class="pdf-footer">Developed by <a href="https://premraichura.me" target="_blank" rel="noopener noreferrer">Prem Raichura</a> | premraichura.me</div>'
      : '<footer class="doc-footer">Developed by <a href="https://premraichura.me" target="_blank" rel="noopener noreferrer">Prem Raichura</a> | <a href="https://premraichura.me" target="_blank" rel="noopener noreferrer">premraichura.me</a></footer>'
    }
</body>
</html>`
}

export default function App() {
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('en')

  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [pipelineStep, setPipelineStep] = useState('idle')

  const [original, setOriginal] = useState('')
  const [translation, setTranslation] = useState('')
  const [duration, setDuration] = useState(0)
  const [detectedLang, setDetectedLang] = useState('')
  const [error, setError] = useState('')

  const [history, setHistory] = useState([])
  const [lastBlob, setLastBlob] = useState(null)
  const [lastFilename, setLastFilename] = useState('audio.webm')
  const [lastAction, setLastAction] = useState('translate')
  const [lastCloudinaryUrl, setLastCloudinaryUrl] = useState(null)
  const [uploaderKey, setUploaderKey] = useState(0)

  const [sourceInfo, setSourceInfo] = useState(null)
  const [sourceStatusMessage, setSourceStatusMessage] = useState('')

  // ── URL input pipeline state ──
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceDetecting, setSourceDetecting] = useState(false)
  const [sourceExtracting, setSourceExtracting] = useState(false)
  const [sourceExtractStatus, setSourceExtractStatus] = useState('')

  const abortRef = useRef(null)
  const extractPollRef = useRef(null)

  const selectedFileForUploader = useMemo(
    () => (lastBlob ? { name: lastFilename, size: lastBlob.size } : null),
    [lastBlob, lastFilename],
  )

  const busy = loading
  const hasOutput = Boolean((original || '').trim() || (translation || '').trim())
  const hasExportableData = Boolean(hasOutput || history.length)
  const sourceLabel = sourceInfo?.label || ''

  const setPipeline = useCallback((step, message) => {
    setPipelineStep(step)
    setStatus(message || '')
  }, [])

  const clearResults = useCallback(() => {
    abortRef.current?.abort()
    setOriginal('')
    setTranslation('')
    setDuration(0)
    setDetectedLang('')
    setError('')
    setLoading(false)
    setStatus('')
    setPipelineStep('idle')
  }, [])

  const resetAll = useCallback(() => {
    clearResults()
    setLastBlob(null)
    setLastFilename('audio.webm')
    setLastAction('translate')
    setLastCloudinaryUrl(null)
    setUploaderKey((k) => k + 1)
    setSourceInfo(null)
    setSourceStatusMessage('')
    setSourceUrl('')
    setSourceDetecting(false)
    setSourceExtracting(false)
    setSourceExtractStatus('')
    if (extractPollRef.current) clearInterval(extractPollRef.current)
  }, [clearResults])

  const appendHistory = useCallback((entryOriginal, entryTranslation) => {
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setHistory((prev) => [
      {
        original: entryOriginal || '',
        translation: entryTranslation || '',
        timestamp: ts,
        sourceLabel: sourceInfo?.label || '',
      },
      ...prev.slice(0, 9),
    ])
  }, [sourceInfo?.label])

  const runTranscription = useCallback(async (blob, filename, action = 'translate') => {
    clearResults()
    setLoading(true)
    setPipeline('transcribe', 'Transcribing...')

    const controller = new AbortController()
    abortRef.current = controller

    let finalOriginal = ''
    let finalTranslation = ''

    try {
      const form = new FormData()
      form.append('audio', blob, filename)
      form.append('source_lang', sourceLang)
      form.append('target_lang', targetLang)
      form.append('action', action)

      const res = await fetch(`${API_BASE}/api/transcribe`, { method: 'POST', body: form, signal: controller.signal })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || `Server error (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let data = null
          try {
            data = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          if (data.type === 'meta') {
            setDuration(data.duration || 0)
            setDetectedLang(data.detected_lang || '')
          } else if (data.type === 'original') {
            finalOriginal = data.text || ''
            setOriginal(finalOriginal)
            if (action === 'translate') setPipeline('translate', 'Translating...')
          } else if (data.type === 'translation_chunk') {
            if (action === 'translate') setPipeline('translate', 'Translating...')
            finalTranslation += data.text || ''
            setTranslation((prev) => prev + (data.text || ''))
          } else if (data.type === 'error') {
            throw new Error(data.message || 'Processing failed.')
          } else if (data.type === 'done') {
            setPipeline('output', 'Output Generated')
            setLoading(false)
            setStatus('')
            if (finalOriginal || finalTranslation) {
              appendHistory(finalOriginal, finalTranslation)
              if (action === 'transcript') {
                toast.success('Transcription complete!')
              } else {
                toast.success('Transcription & translation complete!')
              }
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error(err.message?.slice(0, 80) || 'Something went wrong.')
        setError(err.message || 'Something went wrong.')
        setLoading(false)
        setPipelineStep('error')
      }
    }
  }, [appendHistory, clearResults, setPipeline, sourceLang, targetLang])

  // ── URL-based transcription (used when file was uploaded to Cloudinary) ──────
  // Sends just a URL to the backend — no large file upload to Render.
  const runTranscribeFromUrl = useCallback(async (cloudinaryUrl, action = 'translate') => {
    clearResults()
    setLoading(true)
    setPipeline('transcribe', 'Transcribing...')

    const controller = new AbortController()
    abortRef.current = controller
    let finalOriginal = ''
    let finalTranslation = ''

    try {
      // session:// → uploaded via chunked upload to Render (/api/transcribe-session)
      // https://  → Cloudinary or any HTTPS URL (/api/transcribe-url)
      const isSession = cloudinaryUrl?.startsWith('session://')
      const sessionId = isSession ? cloudinaryUrl.replace('session://', '') : null

      const endpoint = isSession ? `${API_BASE}/api/transcribe-session` : `${API_BASE}/api/transcribe-url`
      const body = isSession
        ? { session_id: sessionId, filename: lastFilename, source_lang: sourceLang, target_lang: targetLang, action }
        : { url: cloudinaryUrl, source_lang: sourceLang, target_lang: targetLang, action }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || `Server error (${res.status})`)
      }


      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let data = null
          try { data = JSON.parse(line.slice(6)) } catch { continue }

          if (data.type === 'progress') {
            setPipeline('transcribe', data.message || 'Transcribing...')
          } else if (data.type === 'meta') {
            setDuration(data.duration || 0)
            setDetectedLang(data.detected_lang || '')
          } else if (data.type === 'original') {
            finalOriginal = data.text || ''
            setOriginal(finalOriginal)
            if (action === 'translate') setPipeline('translate', 'Translating...')
          } else if (data.type === 'translation_chunk') {
            if (action === 'translate') setPipeline('translate', 'Translating...')
            finalTranslation += data.text || ''
            setTranslation((prev) => prev + (data.text || ''))
          } else if (data.type === 'transcript_chunk') {
            finalOriginal += (finalOriginal ? ' ' : '') + (data.text || '')
            setOriginal(finalOriginal)
          } else if (data.type === 'error') {
            throw new Error(data.message || 'Processing failed.')
          } else if (data.type === 'done') {
            setPipeline('output', 'Output Generated')
            setLoading(false)
            setStatus('')
            if (finalOriginal || finalTranslation) {
              appendHistory(finalOriginal, finalTranslation)
              toast.success(action === 'transcript' ? 'Transcription complete!' : 'Transcription & translation complete!')
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error(err.message?.slice(0, 80) || 'Processing failed.')
        setError(err.message || 'Processing failed.')
        setLoading(false)
        setPipelineStep('error')
      }
    }
  }, [appendHistory, clearResults, setPipeline, sourceLang, targetLang])

  const runChunkedTranscript = useCallback(async (blob, filename) => {
    clearResults()
    setLoading(true)
    setPipeline('transcribe', 'Transcribing...')

    const controller = new AbortController()
    abortRef.current = controller
    let finalOriginalText = ''
    let appendQueue = Promise.resolve()

    const WORDS_PER_TICK = 14
    const TICK_MS = 12
    const appendWithTyping = (text) => {
      const words = (text || '').trim().split(/\s+/).filter(Boolean)
      if (!words.length) return Promise.resolve()

      return new Promise((resolve) => {
        let i = 0
        const timer = setInterval(() => {
          if (controller.signal.aborted) {
            clearInterval(timer)
            resolve()
            return
          }
          const chunk = words.slice(i, i + WORDS_PER_TICK).join(' ')
          if (chunk) {
            setOriginal((prev) => {
              const next = prev ? `${prev} ${chunk}` : chunk
              finalOriginalText = next
              return next
            })
          }
          i += WORDS_PER_TICK
          if (i >= words.length) {
            clearInterval(timer)
            resolve()
          }
        }, TICK_MS)
      })
    }

    try {
      const form = new FormData()
      form.append('audio', blob, filename)
      form.append('source_lang', sourceLang)

      const res = await fetch(`${API_BASE}/api/transcribe-large`, { method: 'POST', body: form, signal: controller.signal })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || `Server error (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finished = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let data = null
          try {
            data = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          if (data.type === 'progress') {
            setPipeline('transcribe', data.message || 'Transcribing...')
          } else if (data.type === 'transcript_chunk') {
            appendQueue = appendQueue.then(() => appendWithTyping(data.text || ''))
          } else if (data.type === 'meta') {
            setDuration(data.duration || 0)
            setDetectedLang(data.detected_lang || '')
          } else if (data.type === 'error') {
            throw new Error(data.message || 'Large transcription failed.')
          } else if (data.type === 'done') {
            finished = true
            await appendQueue
            setPipeline('output', 'Output Generated')
            setLoading(false)
            setStatus('')
            if (finalOriginalText) {
              appendHistory(finalOriginalText, '')
              toast.success('Large-file transcription complete!')
            }
          }
        }
      }

      if (!finished) {
        await appendQueue
        setLoading(false)
        setStatus('')
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error(err.message?.slice(0, 80) || 'Large-file transcription failed.')
        setError(err.message || 'Large-file transcription failed.')
        setLoading(false)
        setPipelineStep('error')
      }
    }
  }, [appendHistory, clearResults, setPipeline, sourceLang])

  const runTextTranslation = useCallback(async (text) => {
    const inputText = (text || '').trim()
    if (!inputText) return

    abortRef.current?.abort()
    setTranslation('')
    setError('')
    setLoading(true)
    setPipeline('translate', 'Translating...')

    const controller = new AbortController()
    abortRef.current = controller
    let finalTranslation = ''

    try {
      const res = await fetch(`${API_BASE}/api/translate-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, target_lang: targetLang }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || `Server error (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finished = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let data = null
          try {
            data = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          if (data.type === 'translation_chunk') {
            finalTranslation += data.text || ''
            setTranslation((prev) => prev + (data.text || ''))
          } else if (data.type === 'error') {
            throw new Error(data.message || 'Translation failed.')
          } else if (data.type === 'done') {
            finished = true
            setPipeline('output', 'Output Generated')
            setLoading(false)
            setStatus('')
            if (inputText || finalTranslation) {
              appendHistory(inputText, finalTranslation)
              toast.success('Translation complete!')
            }
          }
        }
      }

      if (!finished) {
        setLoading(false)
        setStatus('')
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error(err.message?.slice(0, 80) || 'Translation failed.')
        setError(err.message || 'Translation failed.')
        setLoading(false)
        setPipelineStep('error')
      }
    }
  }, [appendHistory, setPipeline, targetLang])



  const handleAudioUpload = useCallback((blob, filename = 'audio.webm', cloudinaryUrl = null) => {
    setLastBlob(blob)
    setLastFilename(filename)
    setLastCloudinaryUrl(cloudinaryUrl)
    setSourceInfo({
      source_type: 'direct_audio',
      label: 'Direct Audio',
      requires_extraction: false,
      kind: 'audio',
    })
    setPipeline('input_received', 'Ready to Transcribe')
    setSourceStatusMessage(`Audio selected: ${filename}`)
    setSourceUrl('')
    setSourceDetecting(false)
    setSourceExtracting(false)
    setSourceExtractStatus('')
    toast.success(`File loaded: ${filename}`, { duration: 2000 })
  }, [])

  const clearSelectedAudio = useCallback(() => {
    setLastBlob(null)
    setLastFilename('audio.webm')
    setLastCloudinaryUrl(null)
    setSourceStatusMessage('')
  }, [])

  // ── URL Source Detection & Audio Extraction ────────────────────────────────

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (extractPollRef.current) clearInterval(extractPollRef.current) }
  }, [])

  const handleDetectAndExtract = useCallback(async (url) => {
    const trimmed = (url || '').trim()
    if (!trimmed) { toast.error('Please enter a URL'); return }

    // Clear previous state
    clearResults()
    setLastBlob(null)
    setLastFilename('audio.webm')
    setLastCloudinaryUrl(null)
    setSourceInfo(null)
    setSourceStatusMessage('')
    setSourceExtracting(false)
    setSourceExtractStatus('')
    if (extractPollRef.current) clearInterval(extractPollRef.current)

    // Step 1: Detect source
    setPipeline('input_received', 'Input received')
    setSourceDetecting(true)
    setSourceStatusMessage('Detecting source…')

    let detected
    try {
      const res = await fetch(`${API_BASE}/api/detect-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Detection failed (${res.status})`)
      }
      detected = await res.json()
    } catch (err) {
      setSourceDetecting(false)
      setSourceStatusMessage('')
      toast.error(err.message?.slice(0, 100) || 'Source detection failed')
      return
    }

    setSourceDetecting(false)
    setSourceInfo({
      source_type: detected.source_type,
      label: detected.label,
      kind: detected.kind,
      requires_extraction: detected.requires_extraction,
    })
    setSourceStatusMessage(`Detected: ${detected.label}`)
    toast.success(`Source detected: ${detected.label}`, { duration: 2000 })
    setPipeline('source_detection', 'Source detected')

    // Step 2: Extract audio
    setPipeline('extraction', 'Extracting audio…')
    setSourceExtracting(true)
    setSourceExtractStatus('Starting extraction…')

    let jobId
    try {
      const res = await fetch(`${API_BASE}/api/extract-audio-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Extraction failed (${res.status})`)
      }
      const data = await res.json()
      jobId = data.job_id
    } catch (err) {
      setSourceExtracting(false)
      setSourceExtractStatus('')
      setSourceStatusMessage(`Detection OK, but extraction failed`)
      toast.error(err.message?.slice(0, 100) || 'Audio extraction failed')
      return
    }

    // Step 3: Poll for extraction completion
    extractPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/extract-audio-url/status/${jobId}`)
        if (!res.ok) throw new Error('Polling failed')
        const status = await res.json()

        setSourceExtractStatus(status.message || 'Processing…')

        if (status.status === 'ready') {
          clearInterval(extractPollRef.current)
          extractPollRef.current = null
          setSourceExtractStatus('Downloading audio…')

          // Download the extracted audio blob
          try {
            const dlRes = await fetch(`${API_BASE}/api/extract-audio-url/download/${jobId}`)
            if (!dlRes.ok) throw new Error('Download failed')

            const disposition = dlRes.headers.get('content-disposition')
            const filename = parseDispositionFilename(disposition)
            const blob = await dlRes.blob()

            setLastBlob(blob)
            setLastFilename(filename)
            setLastCloudinaryUrl(null)
            setSourceExtracting(false)
            setSourceExtractStatus('')
            setSourceStatusMessage(`Audio ready: ${filename}`)
            setPipeline('transcribe', 'Ready to Transcribe')
            toast.success(`Audio extracted: ${filename}`, { duration: 3000 })
          } catch (dlErr) {
            setSourceExtracting(false)
            setSourceExtractStatus('')
            setSourceStatusMessage('Extraction completed but download failed')
            toast.error(dlErr.message?.slice(0, 100) || 'Audio download failed')
          }
        } else if (status.status === 'error') {
          clearInterval(extractPollRef.current)
          extractPollRef.current = null
          setSourceExtracting(false)
          setSourceExtractStatus('')
          setSourceStatusMessage('Audio extraction failed')
          toast.error(status.error || 'Audio extraction failed')
        }
      } catch (err) {
        // Network error during poll — keep trying
        console.warn('[extract-poll] error:', err.message)
      }
    }, 2000)
  }, [clearResults, setPipeline])

  const handleTranscript = useCallback(() => {
    if (!lastBlob || busy) return
    setLastAction('transcript')
    // If file was uploaded to Cloudinary, use URL-based endpoint (no large upload to Render)
    if (lastCloudinaryUrl) {
      runTranscribeFromUrl(lastCloudinaryUrl, 'transcript')
      return
    }
    if (lastBlob.size > LARGE_FILE_THRESHOLD_BYTES) {
      runChunkedTranscript(lastBlob, lastFilename)
    } else {
      runTranscription(lastBlob, lastFilename, 'transcript')
    }
  }, [busy, lastBlob, lastCloudinaryUrl, lastFilename, runChunkedTranscript, runTranscribeFromUrl, runTranscription])

  const handleTranslate = useCallback(() => {
    if (busy) return
    setLastAction('translate')
    if ((original || '').trim()) {
      runTextTranslation(original)
      return
    }
    // If file was uploaded to Cloudinary, use URL-based endpoint
    if (lastCloudinaryUrl) {
      runTranscribeFromUrl(lastCloudinaryUrl, 'translate')
      return
    }
    if (lastBlob) runTranscription(lastBlob, lastFilename, 'translate')
  }, [busy, lastBlob, lastCloudinaryUrl, lastFilename, original, runTextTranslation, runTranscribeFromUrl, runTranscription])

  const handleRetry = useCallback(() => {
    if (!lastBlob && !(original || '').trim()) return
    if (lastAction === 'translate' && (original || '').trim()) {
      runTextTranslation(original)
      return
    }
    if (!lastBlob) return
    if (lastAction === 'transcript' && lastBlob.size > LARGE_FILE_THRESHOLD_BYTES) {
      runChunkedTranscript(lastBlob, lastFilename)
      return
    }
    runTranscription(lastBlob, lastFilename, lastAction)
  }, [lastAction, lastBlob, lastFilename, original, runChunkedTranscript, runTextTranslation, runTranscription])

  const exportBundle = useCallback((entries, includeOriginal, includeTranslation) => {
    const now = new Date()
    return {
      entries,
      generatedAt: now.toLocaleString(),
      fileStamp: toSafeFileStamp(now),
      sourceLang,
      targetLang,
      detectedLang,
      duration,
      sourceTypeLabel: sourceLabel,
      includeOriginal,
      includeTranslation,
    }
  }, [detectedLang, duration, sourceLabel, sourceLang, targetLang])

  const exportData = useCallback((format, scope) => {
    let entries = []
    let includeOriginal = true
    let includeTranslation = true
    let filePrefix = 'voice-export'

    if (scope === 'both') {
      entries = buildEntriesForAll(original, translation, history, sourceLabel)
      filePrefix = 'voice-both'
      includeOriginal = true
      includeTranslation = true
    } else if (scope === 'transcript') {
      entries = [{ label: 'Transcript panel', timestamp: '', sourceLabel, original: normalizeParagraphText(original), translation: '' }]
      filePrefix = 'voice-transcript'
      includeOriginal = true
      includeTranslation = false
    } else if (scope === 'translation') {
      entries = [{ label: 'Translation panel', timestamp: '', sourceLabel, original: '', translation: normalizeParagraphText(translation) }]
      filePrefix = 'voice-translation'
      includeOriginal = false
      includeTranslation = true
    }

    const hasPayload = entries.some((entry) => (entry.original || '').trim() || (entry.translation || '').trim())
    if (!hasPayload) return

    const bundle = exportBundle(entries, includeOriginal, includeTranslation)

    if (format === 'txt') {
      const text = buildExportTextReport(bundle)
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      triggerDownload(blob, `${filePrefix}-${bundle.fileStamp}.txt`)
      return
    }

    if (format === 'doc') {
      const html = buildExportHtmlReport({ ...bundle, mode: 'doc' })
      const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' })
      triggerDownload(blob, `${filePrefix}-${bundle.fileStamp}.doc`)
      return
    }

    if (format === 'json') {
      const transcripts = bundle.entries.map((entry) => {
        const item = {
          label: entry.label,
          timestamp: entry.timestamp,
          sourceType: entry.sourceLabel || '',
        }
        if (bundle.includeOriginal) item.transcript = entry.original
        if (bundle.includeTranslation) item.translation = entry.translation
        return item
      })

      const payload = {
        generatedAt: bundle.generatedAt,
        sourceType: bundle.sourceTypeLabel || '',
        sourceLanguage: bundle.sourceLang,
        targetLanguage: bundle.targetLang,
        detectedLanguage: bundle.detectedLang || '',
        duration: bundle.duration || 0,
        transcripts,
        footer: 'DEVELOPED BY : Prem Raichura',
        website: 'https://premraichura.me',
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
      triggerDownload(blob, `${filePrefix}-${bundle.fileStamp}.json`)
      return
    }

    if (format === 'pdf') {
      const html = buildExportHtmlReport({ ...bundle, mode: 'pdf' })
      const printWindow = window.open('', '_blank', 'width=980,height=760')
      if (!printWindow) {
        setError('Popup blocked. Please allow popups, then try PDF export again.')
        return
      }
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => printWindow.print(), 250)
    }
  }, [exportBundle, history, original, sourceLabel, translation])

  return (
    <div className="min-h-screen lg:h-screen w-full bg-transparent relative overflow-hidden text-slate-800 flex flex-col lg:flex-row">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.8)',
            boxShadow: '0 8px 32px rgba(15,23,42,0.08)',
            color: '#0f172a',
            fontSize: '13px',
            fontWeight: '500',
            maxWidth: '360px',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#ffffff' },
            duration: 3000,
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
            duration: 5000,
            style: {
              borderRadius: '12px',
              background: 'rgba(255,245,245,0.97)',
              border: '1px solid rgba(239,68,68,0.15)',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: '500',
              maxWidth: '360px',
            },
          },
        }}
      />
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-indigo-500/10 blur-[120px] animate-pulse-ring" />
        <div className="absolute top-1/3 -right-16 w-72 h-72 rounded-full bg-violet-500/10 blur-[100px] animate-float" />
        <div className="absolute -bottom-16 left-1/3 w-72 h-72 rounded-full bg-sky-500/10 blur-[120px] animate-pulse-ring" />
      </div>

      {/* Sidebar Navigation */}
      <aside className="relative z-20 w-full lg:w-80 border-r border-white/60 backdrop-blur-xl bg-white/60 shadow-glass flex flex-col lg:h-full flex-shrink-0">
        <div className="p-5 border-b border-white/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white border border-white/80 flex items-center justify-center shadow-sm">
            <Mic size={17} className="text-slate-900" />
          </div>
          <div>
            <p className="font-extrabold tracking-tight text-slate-900">VoiceScript Studio</p>
            <p className="text-[11px] text-slate-500">Smart audio dashboard</p>
          </div>
        </div>

        <div className="p-5 border-b border-white/60">
          <LanguageSelector
            sourceLang={sourceLang}
            targetLang={targetLang}
            onSourceChange={setSourceLang}
            onTargetChange={setTargetLang}
            disabled={busy}
          />
        </div>

        <div className="flex-1 p-5 overflow-y-auto scrollbar-thin">
          <History
            items={history}
            onSelect={(item) => {
              setOriginal(item.original)
              setTranslation(item.translation)
              if (item.sourceLabel) {
                setSourceInfo((prev) => ({ ...(prev || {}), label: item.sourceLabel }))
              }
            }}
            onClear={() => setHistory([])}
          />
        </div>
      </aside>

      {/* Main Content Dashboard */}
      <main className="relative z-10 flex-1 h-full overflow-y-auto scrollbar-thin flex flex-col">
        <header className="h-16 border-b border-white/60 backdrop-blur-md bg-white/40 flex items-center justify-between px-6 flex-shrink-0 hidden lg:flex">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles size={12} className="text-indigo-600" />
            Source detection, extraction, transcription, translation
          </div>
          <div className="flex items-center gap-2">
            {(error || hasOutput) && lastBlob && !busy ? (
              <button onClick={handleRetry} className="btn-ghost py-1.5 px-3 text-xs">
                <RefreshCw size={12} /> Retry
              </button>
            ) : null}
            <button onClick={resetAll} disabled={busy} className="btn-ghost py-1.5 px-3 text-xs">
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        </header>

        {/* Dashboard Grid Container */}
        <div className="p-4 lg:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 w-full max-w-7xl mx-auto">

          {/* Top Control Panel: Input Pipeline (Full Width) */}
          <section className="glass-panel xl:col-span-12">
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-6 md:gap-0">

              {/* ── Left: Title + URL Input ── */}
              <div className="w-full md:w-[50%] md:flex-none p-5 flex flex-col gap-4">
                {/* Heading */}
                <div>
                  <h1 className="text-base font-black tracking-tight text-slate-900">Input Pipeline</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Paste a link or upload an audio file to begin.</p>
                </div>

                {/* URL row */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Source URL</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Link2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="url"
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !busy && !sourceDetecting && !sourceExtracting) handleDetectAndExtract(sourceUrl) }}
                        placeholder="https://drive.google.com/file/d/..."
                        disabled={busy || sourceDetecting || sourceExtracting}
                        className="input-url w-full"
                      />
                      {sourceUrl && !sourceDetecting && !sourceExtracting && (
                        <button
                          onClick={() => { setSourceUrl(''); setSourceStatusMessage(''); setSourceInfo(null) }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleDetectAndExtract(sourceUrl)}
                      disabled={busy || sourceDetecting || sourceExtracting || !sourceUrl.trim()}
                      className={`inline-flex items-center gap-2 py-2 px-4 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all duration-200 ${sourceDetecting || sourceExtracting
                        ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                        : 'btn-brand'
                        }`}
                    >
                      {sourceDetecting || sourceExtracting ? (
                        <><Loader2 size={14} className="animate-spin" /> <span>Working</span></>
                      ) : (
                        <><ExternalLink size={14} /> <span>Extract</span></>
                      )}
                    </button>
                  </div>

                  {/* Status line */}
                  {sourceStatusMessage && (
                    <p className="text-xs text-slate-500 pl-1 animate-fade-in flex items-center gap-1.5">
                      {sourceExtracting && <Loader2 size={11} className="animate-spin text-violet-500" />}
                      {lastBlob && sourceInfo && !sourceExtracting && <CheckCircle2 size={11} className="text-emerald-500" />}
                      {sourceStatusMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Right: File Upload ── */}
              <div className="w-full md:w-[40%] md:flex-none pl-4 pr-8 py-4 flex flex-col min-h-[220px]">
                <Uploader key={uploaderKey} onAudioReady={handleAudioUpload} disabled={busy || sourceExtracting} selectedFile={selectedFileForUploader} onClearSelected={clearSelectedAudio} />
              </div>

            </div>
          </section>

          {/* Action & Status Widget (4 Cols) */}
          <section className="xl:col-span-4 flex flex-col gap-6">
            <div className="glass-panel p-5 space-y-4">
              <div className="flex flex-col gap-3">
                <button onClick={handleTranscript} disabled={busy || !lastBlob} className="w-full btn-ghost py-3 text-sm justify-center">
                  <FileText size={16} /> <span>Run Transcript</span>
                </button>
                <button onClick={handleTranslate} disabled={busy || (!lastBlob && !(original || '').trim())} className="w-full btn-brand py-3 text-sm justify-center">
                  <Languages size={16} /> <span>Run Translate</span>
                </button>
              </div>

              {sourceInfo ? (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2 mt-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Detected Source</p>
                  <p className="text-sm font-semibold text-indigo-600 mt-0.5">{sourceInfo.label || 'Unknown'}</p>
                </div>
              ) : null}
            </div>

            <div className="glass-panel p-5 space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Pipeline Status</p>
              {PIPELINE_STEPS.map((step, index) => {
                const stepNum = index + 1
                const rank = STEP_RANK[pipelineStep] || 0
                const done = rank > stepNum || (!busy && rank === stepNum && pipelineStep === 'output')
                const isCurrent = rank === stepNum && !['idle', 'error'].includes(pipelineStep)
                return (
                  <div key={step.id} className="flex items-center gap-2.5">
                    {/* Icon */}
                    {done ? (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={13} className="text-white" strokeWidth={2.5} />
                      </span>
                    ) : isCurrent ? (
                      <span className="w-5 h-5 rounded-full border-2 border-indigo-500 flex items-center justify-center flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0" />
                    )}
                    {/* Label */}
                    <span className={`text-[13px] leading-tight ${done
                      ? 'text-emerald-600 font-medium'
                      : isCurrent
                        ? 'text-slate-800 font-bold'
                        : 'text-slate-400 font-normal'
                      }`}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Transcript Panel Widget (8 Cols) */}
          <section className="xl:col-span-8 flex flex-col gap-4">
            {(hasOutput || hasExportableData) && !busy ? (
              <div className="flex items-center justify-between glass-panel px-5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Export Results</p>
                <div className="flex gap-2">
                  <button onClick={() => exportData('txt', 'both')} className="btn-ghost py-1 px-2.5 text-xs"><Download size={12} /> TXT</button>
                  <button onClick={() => exportData('doc', 'both')} className="btn-ghost py-1 px-2.5 text-xs"><Download size={12} /> DOC</button>
                  <button onClick={() => exportData('pdf', 'both')} className="btn-ghost py-1 px-2.5 text-xs"><Download size={12} /> PDF</button>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm animate-scale-in">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle size={18} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-red-400">Processing error</p>
                    <p className="text-sm text-red-400 mt-1 leading-relaxed">{error}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <TranscriptPanel
              original={original}
              translation={translation}
              loading={busy}
              status={status}
              duration={duration}
              detectedLang={detectedLang}
              sourceLabel={sourceLabel}
              action={lastAction}
              pipelineStep={pipelineStep}
              onExportOriginal={(format) => exportData(format, 'transcript')}
              onExportTranslation={(format) => exportData(format, 'translation')}
            />
          </section>

        </div>
      </main>
    </div>
  )
}
