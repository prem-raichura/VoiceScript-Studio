import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Languages,
  Mic,
  Sparkles,
  Upload,
  Wand2,
  Zap,
  CheckCircle2,
  Globe,
  Download,
  FileText,
  AudioLines,
} from 'lucide-react'

/* ── Palette (Halo USD) ───────────────────────────────────
   bg lavender   #EBE7F2
   dark eggplant #272140
   accent purple #7E6FB3
   cream button  #F5F2EB
   text dark     #211B38
   text muted    #6E6884
─────────────────────────────────────────────────────────── */

const C = {
  bg: '#EBE7F2',
  dark: '#272140',
  dark2: '#221C3A',
  accent: '#7E6FB3',
  accentLight: '#A99BD4',
  cream: '#F5F2EB',
  text: '#211B38',
  muted: '#6E6884',
  cardLight: '#E3DDF1',
}

/* ── Data ─────────────────────────────────────────────── */

const TICKER_ITEMS = [
  'Audio Transcription',
  '13 Languages',
  'Groq Whisper AI',
  'TXT · DOC · PDF · JSON',
  'MP3 · MP4 · WAV · M4A',
  'Free to Use',
  'No Sign-up',
  'Instant Results',
]

const STEPS = [
  { num: '01', icon: Upload, title: 'Upload Your Audio', desc: 'Drop any file or record directly in the browser. MP3, MP4, WAV, M4A and more.' },
  { num: '02', icon: Wand2, title: 'AI Transcribes It', desc: 'Our Whisper-powered engine converts speech to accurate text in seconds.' },
  { num: '03', icon: Languages, title: 'Translate & Export', desc: 'Translate to 13 languages and export in your preferred format.' },
]

/* ── Hooks ─────────────────────────────────────────────── */

function useReveal(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

/* Scroll-reveal wrapper. dir: up | left | right | scale */
function Reveal({ children, dir = 'up', delay = 0, className = '', threshold = 0.2 }) {
  const [ref, visible] = useReveal(threshold)
  const hidden = {
    up: 'translateY(32px)',
    left: 'translateX(-32px)',
    right: 'translateX(32px)',
    scale: 'scale(0.94)',
  }[dir]
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : hidden,
        transition: `opacity 0.8s ease ${delay}ms, transform 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
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
    <div className="flex flex-col items-start">
      <p className="text-4xl font-semibold leading-none tabular-nums tracking-tight" style={{ color: C.text }}>
        {isNumeric ? display + suffix : value}
      </p>
      <p className="text-[11px] font-semibold mt-2 uppercase tracking-widest" style={{ color: C.muted }}>{label}</p>
    </div>
  )
}

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="relative overflow-hidden py-5 border-y" style={{ background: C.cardLight, borderColor: '#D6CEE9' }}>
      <div className="flex gap-16 animate-marquee whitespace-nowrap">
        {items.map((item, i) => (
          <span key={i} className="text-[11px] font-bold uppercase tracking-widest flex-shrink-0 flex items-center gap-4" style={{ color: '#5B527A' }}>
            {item}
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: C.accent }} />
          </span>
        ))}
      </div>
    </div>
  )
}

/* Animated waveform bars for hero visual */
function Waveform() {
  const bars = [28, 46, 70, 40, 88, 56, 100, 64, 38, 76, 50, 92, 44, 68, 34, 80, 52, 96, 42, 60]
  return (
    <div className="flex items-center justify-center gap-[5px] h-28">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[5px] rounded-full animate-wave"
          style={{
            height: `${h}%`,
            background: `linear-gradient(180deg, ${C.accentLight}, ${C.accent})`,
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  )
}

/* ── Main ─────────────────────────────────────────────── */

export default function LandingPage({ onStart }) {
  const [statsRef, statsVisible] = useReveal()
  const [stepsRef, stepsVisible] = useReveal()
  const [cardsRef, cardsVisible] = useReveal()

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans" style={{ background: C.bg, color: C.text }}>

      {/* ── Soft lavender glows ── */}
      <div className="absolute top-0 left-0 w-full h-[900px] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-[10%] -left-[5%] w-[55%] h-[60%] rounded-full blur-[150px] animate-blob" style={{ background: 'rgba(169,155,212,0.35)' }} />
        <div className="absolute top-[15%] -right-[10%] w-[45%] h-[55%] rounded-full blur-[150px] animate-blob" style={{ background: 'rgba(126,111,179,0.22)', animationDelay: '3s' }} />
        <div className="absolute top-0 left-0 w-full h-[500px]" style={{ background: 'linear-gradient(180deg, rgba(244,241,249,0.9) 0%, rgba(235,231,242,0) 100%)' }} />
      </div>

      {/* ── Nav (floating dark pill) ── */}
      <nav className="fixed top-4 inset-x-0 z-50 mx-auto max-w-6xl px-4 animate-fade-down">
        <div className="flex items-center justify-between px-5 py-3 rounded-2xl shadow-lg" style={{ background: C.dark, boxShadow: '0 10px 30px rgba(39,33,64,0.25)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8B7CC4, #6E5FA8)' }}>
              <Mic size={15} className="text-white" />
            </div>
            <span className="font-bold tracking-tight text-[15px] text-white">VoiceScript</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-[13px] font-medium" style={{ color: '#C9C2E0' }}>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#languages" className="hover:text-white transition-colors">Languages</a>
          </div>
          <button
            onClick={onStart}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-transform hover:-translate-y-0.5"
            style={{ background: C.cream, color: C.text }}
          >
            Launch Studio
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative px-6 pt-36 pb-20 max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
        <div className="flex-1 text-left">
          <div className="animate-fade-up inline-flex items-center gap-2 px-3 py-1.5 mb-7 rounded-full border text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.6)', borderColor: '#D6CEE9', color: C.accent }}>
            <Sparkles size={12} className="animate-pulse" />
            Audio Intelligence
          </div>

          <h1 className="animate-fade-up-delay text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.04] mb-7" style={{ color: C.text }}>
            Your Voice,<br />Transcribed.
          </h1>

          <p className="animate-fade-up-delay2 max-w-md text-base sm:text-lg leading-relaxed mb-9" style={{ color: C.muted }}>
            An AI-powered studio that turns any audio into accurate text in seconds — then translates it into 13 languages and exports anywhere. No sign-up required.
          </p>

          <div className="animate-fade-up-delay3 flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-14">
            <button
              onClick={onStart}
              className="group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{ background: C.dark, boxShadow: '0 10px 28px rgba(39,33,64,0.3)' }}
            >
              Start Transcribing
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </button>
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: C.muted }}>
              <CheckCircle2 size={16} style={{ color: C.accent }} />
              100% Free
            </div>
          </div>

          <div ref={statsRef} className="flex gap-10 sm:gap-14 pt-7 border-t" style={{ borderColor: '#D6CEE9' }}>
            {[
              { value: '13', label: 'Languages' },
              { value: '99%', label: 'Accuracy' },
              { value: '10s', label: 'Avg Speed' },
            ].map((s) => (
              <CountUpStat key={s.label} value={s.value} label={s.label} visible={statsVisible} />
            ))}
          </div>
        </div>

        {/* Hero visual card */}
        <div className="flex-1 w-full max-w-md lg:max-w-none relative animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="relative rounded-[1.75rem] p-7 animate-float overflow-hidden" style={{ background: `linear-gradient(150deg, ${C.dark} 0%, ${C.dark2} 100%)`, boxShadow: '0 30px 70px rgba(39,33,64,0.35)' }}>
            <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full blur-3xl" style={{ background: 'rgba(126,111,179,0.45)' }} />
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(169,155,212,0.25)' }}>
                    <AudioLines size={17} style={{ color: C.accentLight }} />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">interview.mp3</p>
                    <p className="text-[11px]" style={{ color: '#9D95BC' }}>Transcribing…</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: C.accent, color: 'white' }}>LIVE</span>
              </div>

              <div className="rounded-2xl p-5 mb-5" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(169,155,212,0.18)' }}>
                <Waveform />
              </div>

              <div className="space-y-3">
                <div className="h-2.5 rounded-full w-full" style={{ background: 'rgba(169,155,212,0.35)' }} />
                <div className="h-2.5 rounded-full w-5/6" style={{ background: 'rgba(169,155,212,0.22)' }} />
                <div className="h-2.5 rounded-full w-4/6" style={{ background: 'rgba(169,155,212,0.15)' }} />
              </div>

              <div className="mt-6 flex items-center gap-3 rounded-xl p-3" style={{ background: 'rgba(245,242,235,0.95)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.cardLight }}>
                  <Globe size={14} style={{ color: C.accent }} />
                </div>
                <p className="text-xs font-medium flex-1" style={{ color: C.text }}>Translated to 13 languages</p>
                <CheckCircle2 size={16} style={{ color: C.accent }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ticker ── */}
      <Reveal dir="up" threshold={0.1}>
        <Ticker />
      </Reveal>

      {/* ── Meet / Features ── */}
      <section id="features" className="px-6 py-28 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
          <Reveal dir="left">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight max-w-md" style={{ color: C.text }}>
              Meet VoiceScript.
            </h2>
          </Reveal>
          <Reveal dir="right" delay={120}>
            <p className="text-base max-w-sm" style={{ color: C.muted }}>
              A complete audio intelligence pipeline — from upload to export — in one distraction-free studio.
            </p>
          </Reveal>
        </div>

        <div ref={cardsRef} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Big light card */}
          <div
            className="lg:row-span-2 rounded-[1.75rem] p-8 flex flex-col justify-between overflow-hidden relative transition-all duration-700"
            style={{
              background: `linear-gradient(160deg, ${C.cardLight} 0%, #D7CFEC 100%)`,
              opacity: cardsVisible ? 1 : 0,
              transform: cardsVisible ? 'translateY(0)' : 'translateY(24px)',
            }}
          >
            <div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'white' }}>
                <Upload size={22} style={{ color: C.accent }} />
              </div>
              <h3 className="text-2xl font-bold mb-3" style={{ color: C.text }}>Effortless upload</h3>
              <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
                Drag & drop any audio or video file, or record straight in the browser. Supports MP3, MP4, WAV, M4A, WebM and more — no conversions needed.
              </p>
            </div>
            <div className="mt-8 rounded-2xl p-6 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.5)' }}>
              <div className="flex items-end gap-1.5 h-20">
                {[40, 65, 90, 55, 75, 100, 60, 85, 45, 70].map((h, i) => (
                  <span key={i} className="w-2 rounded-full animate-wave" style={{ height: `${h}%`, background: C.accent, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </div>
          </div>

          {/* Dark card 1 */}
          <DarkFeatureCard
            visible={cardsVisible} delay={120}
            icon={Zap} title="Fast transcription"
            desc="Powered by Groq Whisper — transcribe hours of audio in seconds with state-of-the-art accuracy."
          />

          {/* Dark card 2 */}
          <DarkFeatureCard
            visible={cardsVisible} delay={240}
            icon={Globe} title="Multi-language"
            desc="Translate transcripts into 13 languages instantly using advanced AI translation models."
          />

          {/* Light wide card */}
          <div
            className="lg:col-span-2 rounded-[1.75rem] p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 transition-all duration-700"
            style={{
              background: C.cardLight,
              opacity: cardsVisible ? 1 : 0,
              transform: cardsVisible ? 'translateY(0)' : 'translateY(24px)',
              transitionDelay: '360ms',
            }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'white' }}>
              <Download size={22} style={{ color: C.accent }} />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2" style={{ color: C.text }}>Export anywhere</h3>
              <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
                Download your results as TXT, DOC, PDF, or JSON — ready to drop into any workflow, document, or app.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="px-6 pb-28 max-w-6xl mx-auto">
        <Reveal dir="scale" threshold={0.15}>
        <div className="rounded-[2rem] overflow-hidden grid grid-cols-1 lg:grid-cols-2" style={{ background: `linear-gradient(150deg, ${C.dark} 0%, ${C.dark2} 100%)` }}>
          <div className="p-10 sm:p-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: C.accentLight }}>How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-10">Three steps to text.</h2>
            <div ref={stepsRef} className="space-y-7">
              {STEPS.map((step, i) => (
                <div
                  key={step.num}
                  className="flex gap-5 transition-all duration-700"
                  style={{
                    opacity: stepsVisible ? 1 : 0,
                    transform: stepsVisible ? 'translateX(0)' : 'translateX(-20px)',
                    transitionDelay: `${i * 150}ms`,
                  }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(169,155,212,0.2)' }}>
                    <step.icon size={19} style={{ color: C.accentLight }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold tracking-widest" style={{ color: C.accentLight }}>{step.num}</span>
                      <h3 className="font-semibold text-white">{step.title}</h3>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: '#A79FC4' }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* visual side */}
          <div className="relative p-10 sm:p-14 flex items-center justify-center" style={{ background: 'rgba(126,111,179,0.12)' }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl" style={{ background: 'rgba(169,155,212,0.4)' }} />
            <div className="relative w-full max-w-xs rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.95)' }}>
              <div className="flex items-center gap-2 mb-4">
                <FileText size={16} style={{ color: C.accent }} />
                <span className="text-xs font-bold" style={{ color: C.text }}>transcript.txt</span>
              </div>
              <div className="space-y-2.5">
                {['w-full', 'w-11/12', 'w-4/5', 'w-full', 'w-3/4', 'w-5/6'].map((w, i) => (
                  <div key={i} className={`h-2 rounded-full ${w}`} style={{ background: i % 2 ? '#E3DDF1' : '#D7CFEC' }} />
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2 text-[11px] font-semibold" style={{ color: C.accent }}>
                <CheckCircle2 size={13} />
                Ready to export
              </div>
            </div>
          </div>
        </div>
        </Reveal>
      </section>

      {/* ── CTA ── */}
      <section id="languages" className="px-6 pb-28 max-w-6xl mx-auto">
        <Reveal dir="scale" threshold={0.15}>
        <div className="relative rounded-[2rem] px-8 py-20 text-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.dark} 0%, #322A52 60%, ${C.dark2} 100%)` }}>
          <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[60%] h-52 rounded-full blur-[100px]" style={{ background: 'rgba(126,111,179,0.5)' }} />
          <div className="relative max-w-xl mx-auto">
            <Reveal dir="up" delay={120}>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-6">
                Ready to transcribe?
              </h2>
            </Reveal>
            <Reveal dir="up" delay={220}>
              <p className="text-base mb-10" style={{ color: '#B5AECC' }}>
                No account needed. Upload your audio and let the AI do the work.
              </p>
            </Reveal>
            <Reveal dir="up" delay={320}>
              <button
                onClick={onStart}
                className="group inline-flex items-center justify-center gap-2.5 px-9 py-4 rounded-2xl font-semibold transition-all hover:-translate-y-0.5"
                style={{ background: C.cream, color: C.text, boxShadow: '0 14px 40px rgba(0,0,0,0.3)' }}
              >
                Open VoiceScript Studio
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
              </button>
            </Reveal>
          </div>
        </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 py-12 border-t" style={{ borderColor: '#D6CEE9' }}>
        <Reveal dir="up" className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.dark }}>
              <Mic size={13} className="text-white" />
            </div>
            <span className="font-bold" style={{ color: C.text }}>VoiceScript</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-x-2 gap-y-1 text-sm font-medium text-center sm:text-left" style={{ color: C.muted }}>
            <span>Powered by Groq Whisper</span>
            <span className="hidden sm:inline" style={{ color: '#C7BFDD' }}>·</span>
            <span className="font-semibold" style={{ color: C.accent }}>Built by Team Shrikhand</span>
          </div>
        </Reveal>
      </footer>
    </div>
  )
}

/* Dark feature card */
function DarkFeatureCard({ icon: Icon, title, desc, visible, delay }) {
  return (
    <div
      className="rounded-[1.75rem] p-8 relative overflow-hidden transition-all duration-700"
      style={{
        background: `linear-gradient(150deg, ${C.dark} 0%, ${C.dark2} 100%)`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full blur-2xl" style={{ background: 'rgba(126,111,179,0.3)' }} />
      <div className="relative">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(169,155,212,0.2)' }}>
          <Icon size={22} style={{ color: C.accentLight }} />
        </div>
        <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: '#A79FC4' }}>{desc}</p>
      </div>
    </div>
  )
}
