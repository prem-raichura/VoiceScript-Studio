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
    color: 'from-violet-500 to-purple-600',
    border: 'border-violet-100',
    glow: 'shadow-violet-200/60',
    title: 'Easy Upload',
    desc: 'Drag & drop any audio or video file. Supports MP3, MP4, WAV, M4A, WebM and more.',
    delay: 0,
  },
  {
    icon: Zap,
    color: 'from-pink-500 to-rose-500',
    border: 'border-pink-100',
    glow: 'shadow-pink-200/60',
    title: 'Fast Transcription',
    desc: 'Powered by Groq Whisper — transcribe hours of audio in seconds with high accuracy.',
    delay: 100,
  },
  {
    icon: Globe,
    color: 'from-cyan-500 to-blue-500',
    border: 'border-cyan-100',
    glow: 'shadow-cyan-200/60',
    title: 'Multi-Language',
    desc: 'Translate transcripts into 13 languages instantly using advanced AI models.',
    delay: 200,
  },
  {
    icon: Download,
    color: 'from-orange-400 to-amber-500',
    border: 'border-orange-100',
    glow: 'shadow-orange-200/60',
    title: 'Export Anywhere',
    desc: 'Download your results as TXT, DOC, PDF, or JSON — ready for any workflow.',
    delay: 300,
  },
]

const STEPS = [
  {
    num: '01',
    icon: Upload,
    color: 'from-violet-500 to-purple-600',
    ring: 'ring-violet-200',
    title: 'Upload Your Audio',
    desc: 'Drop a file or record directly in the browser.',
  },
  {
    num: '02',
    icon: Wand2,
    color: 'from-pink-500 to-rose-500',
    ring: 'ring-pink-200',
    title: 'AI Transcribes It',
    desc: 'Our Whisper-powered engine converts speech to text in seconds.',
  },
  {
    num: '03',
    icon: Languages,
    color: 'from-cyan-500 to-blue-500',
    ring: 'ring-cyan-200',
    title: 'Translate & Export',
    desc: 'Translate to any language and export in your preferred format.',
  },
]

const TICKER_ITEMS = [
  '🎙️ Audio Transcription',
  '🌐 50+ Languages',
  '⚡ Groq Whisper AI',
  '📄 TXT · DOC · PDF · JSON',
  '🎧 MP3 · MP4 · WAV · M4A',
  '✨ Free to Use',
  '🔒 No Sign-up',
  '🚀 Instant Results',
]

const WAVE_HEIGHTS = [35, 60, 80, 55, 90, 45, 70, 50, 85, 40, 65, 75, 48, 88, 52]

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

function AnimatedWaveform() {
  const [heights, setHeights] = useState(WAVE_HEIGHTS)
  useEffect(() => {
    const id = setInterval(() => {
      setHeights(prev => prev.map(() => 20 + Math.random() * 80))
    }, 180)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex items-end justify-center gap-[3px] h-16 px-2">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-violet-500 via-purple-400 to-pink-400"
          style={{
            height: `${h}%`,
            transition: `height ${160 + i * 12}ms cubic-bezier(0.4,0,0.2,1)`,
            opacity: 0.7 + (h / 100) * 0.3,
          }}
        />
      ))}
    </div>
  )
}

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
    <div className="text-center group cursor-default">
      <p className="text-4xl font-black gradient-text leading-none tabular-nums">
        {isNumeric ? display + suffix : value}
      </p>
      <p className="text-xs font-bold text-slate-400 mt-1.5 uppercase tracking-widest">{label}</p>
    </div>
  )
}

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="relative overflow-hidden py-4 bg-gradient-to-r from-violet-600/5 via-pink-500/5 to-cyan-500/5 border-y border-violet-100/60 my-0">
      <div className="flex gap-12 animate-marquee whitespace-nowrap">
        {items.map((item, i) => (
          <span key={i} className="text-sm font-bold text-slate-500 flex-shrink-0 flex items-center gap-2">
            {item}
            <span className="w-1 h-1 rounded-full bg-violet-300 inline-block" />
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
      className="feature-card group relative overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(36px)',
        transition: `opacity 0.55s ease ${f.delay}ms, transform 0.55s cubic-bezier(0.4,0,0.2,1) ${f.delay}ms`,
      }}
    >
      {/* Hover shimmer sweep */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: 'linear-gradient(120deg, transparent 30%, rgba(124,58,237,0.04) 50%, transparent 70%)' }}
      />
      <div className={`w-13 h-13 w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 shadow-xl ${f.glow} group-hover:scale-110 transition-transform duration-300`}>
        <f.icon size={22} className="text-white" />
      </div>
      <h3 className="font-bold text-slate-900 text-base mb-2">{f.title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────── */

export default function LandingPage({ onStart }) {
  const [statsRef, statsVisible] = useReveal()
  const [stepsRef, stepsVisible] = useReveal()
  const [ripple, setRipple] = useState(null)

  const handleStart = useCallback((e) => {
    const btn = e.currentTarget
    const rect = btn.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setRipple({ x, y })
    setTimeout(() => { setRipple(null); onStart() }, 380)
  }, [onStart])

  return (
    <div className="relative min-h-screen overflow-x-hidden">

      {/* ── Animated Background Orbs ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="glow-orb absolute -top-40 -left-40 w-[700px] h-[700px] bg-violet-400/18 animate-float" />
        <div className="glow-orb absolute top-1/4 -right-48 w-[550px] h-[550px] bg-pink-400/14 animate-float-alt" />
        <div className="glow-orb absolute bottom-0 left-1/3 w-[600px] h-[600px] bg-cyan-400/10 animate-float" style={{ animationDelay: '3s' }} />
        <div className="glow-orb absolute top-2/3 -left-24 w-[400px] h-[400px] bg-orange-400/08 animate-float-alt" style={{ animationDelay: '5s' }} />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: 'linear-gradient(#7c3aed 1px, transparent 1px), linear-gradient(90deg, #7c3aed 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />
      </div>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-xl bg-white/75 border-b border-white/80 shadow-sm animate-fade-down">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-200 animate-pulse-ring">
            <Mic size={17} className="text-white" />
          </div>
          <span className="font-extrabold text-slate-900 tracking-tight text-lg">
            VoiceScript <span className="gradient-text">Studio</span>
          </span>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-20 pb-10">

        {/* Pill badge with spinning icon */}
        <div className="animate-fade-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-100 to-pink-100 border border-violet-200 text-violet-700 text-xs font-bold uppercase tracking-widest mb-8 shadow-sm">
          <Sparkles size={11} className="animate-spin-slow" />
          AI-Powered Audio Intelligence
        </div>

        {/* Headline */}
        <h1 className="animate-fade-up-delay max-w-4xl text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] text-slate-900 text-balance mb-6">
          Transcribe. Translate.{' '}
          <span className="gradient-text animate-gradient bg-[length:200%_auto]">Export.</span>
        </h1>

        {/* Sub */}
        <p className="animate-fade-up-delay2 max-w-xl text-lg text-slate-500 leading-relaxed mb-10 text-balance">
          Turn any audio file into accurate text in seconds. Translate to 50+ languages
          and export in the format you need — all for free.
        </p>

        {/* CTA */}
        <div className="animate-fade-up-delay3 flex flex-col sm:flex-row items-center gap-4 mb-14">
          <button
            id="hero-start-btn"
            onClick={handleStart}
            className="hero-btn group relative overflow-hidden"
          >
            {ripple && (
              <span
                className="absolute rounded-full bg-white/30 animate-ripple"
                style={{ width: 200, height: 200, top: ripple.y - 100, left: ripple.x - 100 }}
              />
            )}
            <Play size={16} fill="white" className="group-hover:scale-110 transition-transform" />
            <span>Start Transcribing</span>
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CheckCircle2 size={15} className="text-green-500" />
            No sign-up required
          </div>
        </div>




        {/* Stats */}
        <div ref={statsRef} className="flex flex-wrap justify-center gap-10 sm:gap-16 mt-4">
          {[
            { value: '13', label: 'Languages' },
            { value: '99%', label: 'Accuracy' },
            { value: '10s', label: 'Avg Speed' },
            { value: 'Free', label: 'To Use' },
          ].map((s) => (
            <CountUpStat key={s.label} value={s.value} label={s.label} visible={statsVisible} />
          ))}
        </div>

        {/* App preview mockup */}
        <div className="animate-fade-up-delay3 mt-14 w-full max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden border-2 border-white shadow-[0_32px_80px_rgba(109,40,217,0.18),0_0_0_1px_rgba(255,255,255,0.8)]">
            {/* Top bar */}
            <div className="bg-white/85 backdrop-blur-xl px-5 py-3 flex items-center gap-2 border-b border-slate-100">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="ml-4 flex-1 h-6 rounded-full bg-slate-100 flex items-center px-3">
                <span className="text-xs text-slate-400 font-mono">voicescript-studio.vercel.app</span>
              </div>
            </div>
            {/* Content */}
            <div className="bg-gradient-to-br from-slate-50 via-violet-50/30 to-pink-50/20 p-6 min-h-[220px] flex items-center justify-center">
              <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
                <div className="col-span-3 bg-white/75 rounded-2xl p-4 border border-white shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <Mic size={18} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="h-3 w-2/3 bg-gradient-to-r from-violet-200 to-pink-200 rounded-full mb-2 shimmer-bg" />
                    <div className="h-2 w-1/2 bg-slate-100 rounded-full" />
                  </div>
                  <div className="h-8 w-28 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 opacity-80 animate-pulse" />
                </div>
                <div className="col-span-2 bg-white/75 rounded-2xl p-4 border border-white shadow-sm">
                  <div className="h-2 w-1/3 bg-violet-200 rounded-full mb-3" />
                  <div className="space-y-2">
                    {[0.9, 0.7, 0.85, 0.6, 0.8].map((w, i) => (
                      <div key={i} className="h-2 bg-gradient-to-r from-slate-100 to-violet-50 rounded-full shimmer-bg" style={{ width: `${w * 100}%`, animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
                <div className="bg-white/75 rounded-2xl p-4 border border-white shadow-sm">
                  <div className="h-2 w-1/2 bg-pink-200 rounded-full mb-3" />
                  <div className="space-y-2">
                    {[0.8, 0.65, 0.75].map((w, i) => (
                      <div key={i} className="h-2 bg-gradient-to-r from-slate-100 to-pink-50 rounded-full shimmer-bg" style={{ width: `${w * 100}%`, animationDelay: `${i * 0.2}s` }} />
                    ))}
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
      <section className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-bold uppercase tracking-widest mb-4">
            <Shield size={11} /> Everything You Need
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">
            Built for <span className="gradient-text">speed & accuracy</span>
          </h2>
          <p className="text-slate-500 mt-3 max-w-lg mx-auto">
            A complete audio intelligence pipeline — from upload to export — in one clean interface.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => <FeatureCard key={f.title} f={f} index={i} />)}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-6 py-20 bg-gradient-to-br from-violet-50/60 via-white/40 to-pink-50/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-bold uppercase tracking-widest mb-4">
              <Sparkles size={11} className="animate-spin-slow" /> Simple Process
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">
              How it <span className="gradient-text">works</span>
            </h2>
          </div>

          <div ref={stepsRef} className="flex flex-col lg:flex-row items-stretch gap-0">
            {STEPS.map((step, i) => (
              <div key={step.num} className="flex-1 flex flex-col lg:flex-row items-center">
                <div
                  className="feature-card flex-1 flex flex-col items-center text-center p-8 w-full group"
                  style={{
                    opacity: stepsVisible ? 1 : 0,
                    transform: stepsVisible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
                    transition: `opacity 0.5s ease ${i * 150}ms, transform 0.5s cubic-bezier(0.4,0,0.2,1) ${i * 150}ms`,
                  }}
                >
                  <div className={`text-3xl font-black tracking-widest bg-gradient-to-br ${step.color} bg-clip-text text-transparent mb-4 opacity-30 group-hover:opacity-60 transition-opacity`}>
                    {step.num}
                  </div>
                  <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-5 shadow-xl ring-4 ${step.ring} group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                    <step.icon size={28} className="text-white" />
                    <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h3 className="font-black text-slate-900 text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:flex items-center px-2">
                    <div className="flex flex-col items-center gap-1">
                      {[0, 1, 2].map((d) => (
                        <div
                          key={d}
                          className="w-1.5 h-1.5 rounded-full bg-gradient-to-b from-violet-400 to-pink-400"
                          style={{
                            opacity: stepsVisible ? 1 : 0,
                            transition: `opacity 0.3s ease ${0.5 + d * 0.1}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600 p-12 shadow-[0_24px_80px_rgba(124,58,237,0.40)] animate-gradient bg-[length:200%_200%]">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl animate-pulse-ring" />
          <div className="absolute bottom-0 right-0 w-72 h-72 bg-pink-400/20 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl animate-float-alt" />
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 text-white/90 text-xs font-bold uppercase tracking-widest mb-6 border border-white/25">
              <Zap size={11} fill="currentColor" className="animate-pulse" /> Free & Instant
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
              Ready to transcribe?
            </h2>
            <p className="text-white/75 text-lg mb-8 max-w-md mx-auto">
              No account needed. Just upload your audio and let the AI do the work.
            </p>
            <button
              id="cta-start-btn"
              onClick={handleStart}
              className="relative overflow-hidden inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-white text-violet-700 font-black text-base shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 active:scale-95 group"
            >
              <FileText size={18} className="group-hover:rotate-6 transition-transform" />
              Open VoiceScript Studio
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/60 backdrop-blur-xl bg-white/55 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center shadow-md shadow-violet-200">
              <Mic size={14} className="text-white" />
            </div>
            <span className="font-black text-slate-800">VoiceScript Studio</span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Developed by{' '}
            <span className="gradient-text font-bold">Team Shrikand</span>
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 size={12} className="text-green-500" />
            Powered by Groq Whisper
          </div>
        </div>
      </footer>

    </div>
  )
}
