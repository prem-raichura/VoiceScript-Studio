import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  FileText,
  Languages,
  Mic,
  Sparkles,
  Upload,
  Wand2,
  Zap,
  CheckCircle2,
  Globe,
  Download,
  Shield,
  Play,
} from 'lucide-react'

/* ── Data ─────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Upload,
    color: 'bg-mud-clay/20 text-mud-clay',
    border: 'border-mud-clay/30',
    title: 'Easy Upload',
    desc: 'Drag & drop any audio or video file. Supports MP3, MP4, WAV, M4A, WebM and more.',
    delay: 0,
  },
  {
    icon: Zap,
    color: 'bg-mud-moss/20 text-mud-moss',
    border: 'border-mud-moss/30',
    title: 'Fast Transcription',
    desc: 'Powered by Groq Whisper — transcribe hours of audio in seconds with high accuracy.',
    delay: 100,
  },
  {
    icon: Globe,
    color: 'bg-mud-base/20 text-mud-base',
    border: 'border-mud-base/30',
    title: 'Multi-Language',
    desc: 'Translate transcripts into 13 languages instantly using advanced AI models.',
    delay: 200,
  },
  {
    icon: Download,
    color: 'bg-mud-moss/20 text-mud-moss',
    border: 'border-mud-moss/30',
    title: 'Export Anywhere',
    desc: 'Download your results as TXT, DOC, PDF, or JSON — ready for any workflow.',
    delay: 300,
  },
]

const STEPS = [
  {
    num: '01',
    icon: Upload,
    color: 'bg-mud-clay/40 text-mud-clay',
    title: 'Upload Your Audio',
    desc: 'Drop a file or record directly in the browser.',
  },
  {
    num: '02',
    icon: Wand2,
    color: 'bg-mud-base/40 text-mud-base',
    title: 'AI Transcribes It',
    desc: 'Our Whisper-powered engine converts speech to text in seconds.',
  },
  {
    num: '03',
    icon: Languages,
    color: 'bg-mud-moss/40 text-mud-moss',
    title: 'Translate & Export',
    desc: 'Translate to any language and export in your preferred format.',
  },
]

const TICKER_ITEMS = [
  'Audio Transcription',
  '50+ Languages',
  'Groq Whisper AI',
  'TXT · DOC · PDF · JSON',
  'MP3 · MP4 · WAV · M4A',
  'Free to Use',
  'No Sign-up',
  'Instant Results',
]

/* ── Hooks ─────────────────────────────────────────────── */

function useReveal() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

/* ── Sub-components ─────────────────────────────────────── */

function CountUpStat({ value, label, visible }) {
  const isNumeric = /^\d+/.test(value)
  const end = isNumeric ? parseInt(value) : null
  const suffix = isNumeric ? value.replace(String(end), '') : ''
  const [display, setDisplay] = useState(isNumeric ? 0 : value)

  useEffect(() => {
    if (!visible || !isNumeric) return
    let start = 0
    const step = Math.ceil(end / 40)
    const id = setInterval(() => {
      start += step
      if (start >= end) { setDisplay(end); clearInterval(id) }
      else setDisplay(start)
    }, 30)
    return () => clearInterval(id)
  }, [visible, end, isNumeric])

  return (
    <div className="group cursor-default flex flex-col items-start">
      <p className="text-4xl font-light text-mud-dark leading-none tabular-nums tracking-tighter">
        {isNumeric ? display + suffix : value}
      </p>
      <p className="text-[11px] font-semibold text-mud-light0 mt-2 uppercase tracking-widest">{label}</p>
    </div>
  )
}

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="relative overflow-hidden py-5 bg-mud-light border-y border-mud-base/30 my-0">
      <div className="flex gap-16 animate-marquee whitespace-nowrap">
        {items.map((item, i) => (
          <span key={i} className="text-[11px] font-medium uppercase tracking-widest text-mud-light0 flex-shrink-0 flex items-center gap-4">
            {item}
            <span className="w-1 h-1 rounded-full bg-mud-base inline-block" />
          </span>
        ))}
      </div>
    </div>
  )
}

function FeatureCard({ f, index }) {
  const [ref, visible] = useReveal()
  return (
    <div
      ref={ref}
      className={`group relative overflow-hidden transition-all duration-500 p-8 rounded-2xl bg-white border border-mud-base/30 hover:border-mud-base/50 hover:shadow-sm`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.7s ease ${f.delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${f.delay}ms`,
      }}
    >
      <div className={`w-12 h-12 rounded-xl border ${f.color} ${f.border} flex items-center justify-center mb-6`}>
        <f.icon size={20} />
      </div>
      <h3 className="font-semibold text-mud-dark text-lg mb-3 tracking-tight">{f.title}</h3>
      <p className="text-sm text-mud-light0 leading-relaxed">{f.desc}</p>
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────── */

export default function LandingPage({ onStart }) {
  const [statsRef, statsVisible] = useReveal()
  const [stepsRef, stepsVisible] = useReveal()

  return (
    <div className="relative min-h-screen bg-mud-light overflow-x-hidden font-sans text-mud-dark">
      
      {/* ── Nav ── */}
      <nav className="fixed w-full top-0 z-50 flex items-center justify-between px-8 py-5 bg-mud-light/90 backdrop-blur-md animate-fade-down border-b border-mud-base/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-mud-dark flex items-center justify-center">
            <Mic size={14} className="text-mud-light" />
          </div>
          <span className="font-bold text-mud-dark tracking-tight text-lg">
            VoiceScript
          </span>
        </div>
        <button onClick={onStart} className="text-sm font-semibold text-mud-dark hover:text-mud-light0 transition-colors">
          Open App →
        </button>
      </nav>

      {/* ── Hero ── */}
      <section className="relative px-8 pt-40 pb-24 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
        
        <div className="flex-1 text-left">
          <div className="animate-fade-up inline-flex items-center gap-2 px-3 py-1 mb-8 rounded bg-mud-base/20 border border-mud-base/30 text-mud-base text-xs font-semibold tracking-wide">
            <Sparkles size={12} className="text-mud-base" />
            Audio Intelligence
          </div>

          <h1 className="animate-fade-up-delay max-w-2xl text-6xl sm:text-7xl lg:text-8xl font-light tracking-tighter leading-[1.05] text-mud-dark mb-8">
            Audio to text, <br/>
            <span className="font-bold">instantly.</span>
          </h1>

          <p className="animate-fade-up-delay2 max-w-xl text-lg sm:text-xl text-mud-light0 leading-relaxed mb-12">
            Turn any audio file into accurate text in seconds. Translate to 13 languages and export in the format you need. 
            No sign-up required.
          </p>

          <div className="animate-fade-up-delay3 flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-16">
            <button
              onClick={onStart}
              className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-mud-dark text-mud-light rounded-full font-medium transition-all hover:bg-mud-dark hover:scale-[1.02] active:scale-95"
            >
              Start Transcribing
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </button>
            <div className="flex items-center gap-2 text-sm font-medium text-mud-light0">
              <CheckCircle2 size={16} className="text-mud-dark/50" />
              100% Free
            </div>
          </div>

          <div ref={statsRef} className="flex gap-12 sm:gap-16 pt-8 border-t border-mud-base/30">
            {[
              { value: '13', label: 'Languages' },
              { value: '99%', label: 'Accuracy' },
              { value: '10s', label: 'Avg Speed' },
            ].map((s) => (
              <CountUpStat key={s.label} value={s.value} label={s.label} visible={statsVisible} />
            ))}
          </div>
        </div>

        <div className="flex-1 w-full max-w-lg lg:max-w-none relative animate-fade-in" style={{animationDelay: '0.4s'}}>
          <div className="relative bg-white rounded-3xl p-2 border border-mud-base/30 shadow-2xl shadow-mud-dark/5">
            <div className="bg-mud-light rounded-[1.25rem] border border-mud-base/20 overflow-hidden h-[500px] flex flex-col">
              <div className="h-14 border-b border-mud-base/30 bg-white flex items-center px-6 gap-4">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-mud-base" />
                  <div className="w-2.5 h-2.5 rounded-full bg-mud-base" />
                  <div className="w-2.5 h-2.5 rounded-full bg-mud-base" />
                </div>
              </div>
              <div className="flex-1 p-8 flex flex-col gap-6">
                <div className="w-full bg-white border border-mud-base/30 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded bg-mud-light flex items-center justify-center">
                      <Mic size={18} className="text-mud-dark" />
                    </div>
                    <div className="flex-1">
                      <div className="h-2.5 w-32 bg-mud-light rounded-full mb-2" />
                      <div className="h-2 w-16 bg-mud-light rounded-full" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-2 bg-mud-light rounded-full w-full" />
                    <div className="h-2 bg-mud-light rounded-full w-5/6" />
                    <div className="h-2 bg-mud-light rounded-full w-4/6" />
                  </div>
                </div>
                <div className="w-full bg-white border border-mud-base/30 rounded-xl p-5 shadow-sm">
                   <div className="space-y-3">
                    <div className="h-2 bg-mud-light rounded-full w-full" />
                    <div className="h-2 bg-mud-light rounded-full w-3/4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* ── Ticker ── */}
      <Ticker />

      {/* ── Features ── */}
      <section className="px-8 py-32 max-w-7xl mx-auto">
        <div className="mb-16 animate-fade-up">
          <h2 className="text-4xl sm:text-5xl font-light text-mud-dark tracking-tighter mb-6">
            Everything you need. <br/>
            <span className="font-bold">Nothing you don't.</span>
          </h2>
          <p className="text-mud-light0 text-lg max-w-xl">
            A complete audio intelligence pipeline — from upload to export — wrapped in a minimalist, distraction-free interface.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => <FeatureCard key={f.title} f={f} index={i} />)}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-8 py-32 bg-white border-y border-mud-base/30">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20 text-center">
            <h2 className="text-4xl sm:text-5xl font-light text-mud-dark tracking-tighter">
              Simple <span className="font-bold">Process</span>
            </h2>
          </div>

          <div ref={stepsRef} className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-20">
            {STEPS.map((step, i) => (
              <div 
                key={step.num} 
                className="flex flex-col items-center sm:items-start text-center sm:text-left transition-all duration-700"
                style={{
                  opacity: stepsVisible ? 1 : 0,
                  transform: stepsVisible ? 'translateY(0)' : 'translateY(24px)',
                  transitionDelay: `${i * 150}ms`
                }}
              >
                <div className="text-sm font-bold text-mud-dark/50 mb-6 tracking-widest">{step.num}</div>
                <div className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center mb-8`}>
                  <step.icon size={24} />
                </div>
                <h3 className="font-semibold text-mud-dark text-xl mb-4 tracking-tight">{step.title}</h3>
                <p className="text-mud-light0 leading-relaxed text-base">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="px-8 py-32 bg-mud-dark text-mud-light text-center flex flex-col items-center">
        <div className="max-w-2xl">
          <h2 className="text-5xl sm:text-6xl font-light tracking-tighter mb-8">
            Ready to <span className="font-bold">transcribe?</span>
          </h2>
          <p className="text-mud-dark/50 text-lg mb-12">
            No account needed. Just upload your audio and let the AI do the work.
          </p>
          <button
            onClick={onStart}
            className="group inline-flex items-center justify-center gap-3 px-10 py-5 bg-mud-light text-mud-dark rounded-full font-semibold transition-all hover:bg-white hover:scale-[1.02] active:scale-95"
          >
            Open VoiceScript Studio
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-mud-light px-8 py-12 border-t border-mud-base/30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-mud-dark flex items-center justify-center">
              <Mic size={12} className="text-mud-light" />
            </div>
            <span className="font-bold text-mud-dark">VoiceScript</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-mud-light0">
            Powered by Groq Whisper
          </div>
        </div>
      </footer>

    </div>
  )
}
