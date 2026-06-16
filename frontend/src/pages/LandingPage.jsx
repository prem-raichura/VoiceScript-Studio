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
    color: 'bg-rose-100 text-rose-600',
    border: 'border-rose-200',
    title: 'Easy Upload',
    desc: 'Drag & drop any audio or video file. Supports MP3, MP4, WAV, M4A, WebM and more.',
    delay: 0,
  },
  {
    icon: Zap,
    color: 'bg-amber-100 text-amber-600',
    border: 'border-amber-200',
    title: 'Fast Transcription',
    desc: 'Powered by Groq Whisper — transcribe hours of audio in seconds with high accuracy.',
    delay: 100,
  },
  {
    icon: Globe,
    color: 'bg-teal-100 text-teal-600',
    border: 'border-teal-200',
    title: 'Multi-Language',
    desc: 'Translate transcripts into 13 languages instantly using advanced AI models.',
    delay: 200,
  },
  {
    icon: Download,
    color: 'bg-emerald-100 text-emerald-600',
    border: 'border-emerald-200',
    title: 'Export Anywhere',
    desc: 'Download your results as TXT, DOC, PDF, or JSON — ready for any workflow.',
    delay: 300,
  },
]

const STEPS = [
  {
    num: '01',
    icon: Upload,
    color: 'bg-gradient-to-br from-rose-100 to-orange-100 text-rose-600',
    title: 'Upload Your Audio',
    desc: 'Drop a file or record directly in the browser.',
  },
  {
    num: '02',
    icon: Wand2,
    color: 'bg-gradient-to-br from-teal-100 to-cyan-100 text-teal-600',
    title: 'AI Transcribes It',
    desc: 'Our Whisper-powered engine converts speech to text in seconds.',
  },
  {
    num: '03',
    icon: Languages,
    color: 'bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700',
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
      <p className="text-4xl font-light text-slate-900 leading-none tabular-nums tracking-tighter">
        {isNumeric ? display + suffix : value}
      </p>
      <p className="text-[11px] font-semibold text-slate-500 mt-2 uppercase tracking-widest">{label}</p>
    </div>
  )
}

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="relative overflow-hidden py-5 bg-gradient-to-r from-teal-50 via-cyan-50 to-emerald-50 border-y border-teal-100 my-0">
      <div className="flex gap-16 animate-marquee whitespace-nowrap">
        {items.map((item, i) => (
          <span key={i} className="text-[11px] font-bold uppercase tracking-widest text-teal-900/60 flex-shrink-0 flex items-center gap-4">
            {item}
            <span className="w-1.5 h-1.5 rounded-full bg-teal-300 inline-block" />
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
      className={`group relative overflow-hidden transition-all duration-500 p-8 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.7s ease ${f.delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${f.delay}ms`,
      }}
    >
      <div className={`w-12 h-12 rounded-xl border ${f.color} ${f.border} flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6`}>
        <f.icon size={20} />
      </div>
      <h3 className="font-semibold text-slate-900 text-lg mb-3 tracking-tight">{f.title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────── */

export default function LandingPage({ onStart }) {
  const [statsRef, statsVisible] = useReveal()
  const [stepsRef, stepsVisible] = useReveal()

  return (
    <div className="relative min-h-screen bg-slate-50 overflow-x-hidden font-sans text-slate-900">
      
      {/* ── Background Globs ── */}
      <div className="absolute top-0 left-0 w-full h-[800px] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[60%] rounded-full bg-teal-400/20 blur-[120px] animate-blob" />
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[50%] rounded-full bg-cyan-400/20 blur-[120px] animate-blob" style={{animationDelay: '2s'}} />
        <div className="absolute -bottom-[10%] left-[20%] w-[60%] h-[50%] rounded-full bg-emerald-400/20 blur-[120px] animate-blob" style={{animationDelay: '4s'}} />
      </div>

      {/* ── Nav ── */}
      <nav className="fixed w-full top-0 z-50 flex items-center justify-between px-8 py-5 bg-white/80 backdrop-blur-md animate-fade-down border-b border-slate-200/60 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center">
            <Mic size={14} className="text-slate-50" />
          </div>
          <span className="font-bold text-slate-900 tracking-tight text-lg">
            VoiceScript
          </span>
        </div>
        <button onClick={onStart} className="text-sm font-semibold text-slate-900 hover:text-slate-500 transition-colors">
          Open App →
        </button>
      </nav>

      {/* ── Hero ── */}
      <section className="relative px-8 pt-40 pb-24 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
        
        <div className="flex-1 text-left">
          <div className="animate-fade-up inline-flex items-center gap-2 px-3 py-1 mb-8 rounded bg-teal-50 border border-teal-200 text-teal-600 text-xs font-semibold tracking-wide">
            <Sparkles size={12} className="text-teal-600 animate-pulse" />
            Audio Intelligence
          </div>

          <h1 className="animate-fade-up-delay max-w-2xl text-6xl sm:text-7xl lg:text-8xl font-light tracking-tighter leading-[1.05] text-slate-900 mb-8">
            Audio to text, <br/>
            <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-500 animate-text-shimmer inline-block">instantly.</span>
          </h1>

          <p className="animate-fade-up-delay2 max-w-xl text-lg sm:text-xl text-slate-500 leading-relaxed mb-12">
            Turn any audio file into accurate text in seconds. Translate to 13 languages and export in the format you need. 
            No sign-up required.
          </p>

          <div className="animate-fade-up-delay3 flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-16">
            <button
              onClick={onStart}
              className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-full font-semibold transition-all shadow-glow-indigo hover:-translate-y-0.5 active:translate-y-0"
            >
              Start Transcribing
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </button>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <CheckCircle2 size={16} className="text-slate-900/50" />
              100% Free
            </div>
          </div>

          <div ref={statsRef} className="flex gap-12 sm:gap-16 pt-8 border-t border-slate-200">
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
          <div className="relative bg-white rounded-3xl p-2 border border-slate-200 shadow-2xl shadow-slate-900/5 animate-float">
            <div className="bg-slate-50 rounded-[1.25rem] border border-slate-200 overflow-hidden h-[500px] flex flex-col">
              <div className="h-14 border-b border-slate-200 bg-white flex items-center px-6 gap-4">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-100" />
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-100" />
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-100" />
                </div>
              </div>
              <div className="flex-1 p-8 flex flex-col gap-6">
                <div className="w-full bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded bg-slate-50 flex items-center justify-center group-hover:animate-bounce">
                      <Mic size={18} className="text-teal-600" />
                    </div>
                    <div className="flex-1">
                      <div className="h-2.5 w-32 bg-slate-50 rounded-full mb-2" />
                      <div className="h-2 w-16 bg-slate-50 rounded-full" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-2 bg-slate-50 rounded-full w-full" />
                    <div className="h-2 bg-slate-50 rounded-full w-5/6" />
                    <div className="h-2 bg-slate-50 rounded-full w-4/6" />
                  </div>
                </div>
                <div className="w-full bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                   <div className="space-y-3">
                    <div className="h-2 bg-slate-50 rounded-full w-full" />
                    <div className="h-2 bg-slate-50 rounded-full w-3/4" />
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
        <div className="mb-16">
          <h2 className="text-4xl sm:text-5xl font-light text-slate-900 tracking-tighter mb-6">
            Everything you need. <br/>
            <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-cyan-500 animate-text-shimmer inline-block">Nothing you don't.</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl">
            A complete audio intelligence pipeline — from upload to export — wrapped in a minimalist, distraction-free interface.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => <FeatureCard key={f.title} f={f} index={i} />)}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-8 py-32 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20 text-center">
            <h2 className="text-4xl sm:text-5xl font-light text-slate-900 tracking-tighter">
              Simple <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-cyan-500 animate-text-shimmer inline-block">Process</span>
            </h2>
          </div>

          <div ref={stepsRef} className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-20">
            {STEPS.map((step, i) => (
              <div 
                key={step.num} 
                className="group flex flex-col items-center sm:items-start text-center sm:text-left transition-all duration-700 hover:-translate-y-2 cursor-default"
                style={{
                  opacity: stepsVisible ? 1 : 0,
                  transform: stepsVisible ? 'translateY(0)' : 'translateY(24px)',
                  transitionDelay: `${i * 150}ms`
                }}
              >
                <div className="text-sm font-bold text-slate-900/50 mb-6 tracking-widest">{step.num}</div>
                <div className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center mb-8 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12`}>
                  <step.icon size={24} />
                </div>
                <h3 className="font-semibold text-slate-900 text-xl mb-4 tracking-tight">{step.title}</h3>
                <p className="text-slate-500 leading-relaxed text-base">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="px-8 py-32 bg-gradient-to-br from-teal-900 via-cyan-900 to-slate-900 text-white text-center flex flex-col items-center">
        <div className="max-w-2xl">
          <h2 className="text-5xl sm:text-6xl font-light tracking-tighter mb-8">
            Ready to <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-300 to-cyan-200 animate-text-shimmer inline-block">transcribe?</span>
          </h2>
          <p className="text-white/60 text-lg mb-12">
            No account needed. Just upload your audio and let the AI do the work.
          </p>
          <button
            onClick={onStart}
            className="group inline-flex items-center justify-center gap-3 px-10 py-5 bg-slate-50 text-slate-900 rounded-full font-semibold transition-all hover:bg-white hover:scale-[1.02] active:scale-95"
          >
            Open VoiceScript Studio
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-50 px-8 py-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center">
              <Mic size={12} className="text-slate-50" />
            </div>
            <span className="font-bold text-slate-900">VoiceScript</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            Powered by Groq Whisper
          </div>
        </div>
      </footer>

    </div>
  )
}
