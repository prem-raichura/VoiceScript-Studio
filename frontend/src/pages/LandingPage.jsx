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
} from 'lucide-react'

const FEATURES = [
  {
    icon: Upload,
    color: 'from-violet-500 to-purple-600',
    bg: 'from-violet-50 to-purple-50',
    border: 'border-violet-100',
    title: 'Easy Upload',
    desc: 'Drag & drop any audio or video file. Supports MP3, MP4, WAV, M4A, WebM and more.',
  },
  {
    icon: Zap,
    color: 'from-pink-500 to-rose-500',
    bg: 'from-pink-50 to-rose-50',
    border: 'border-pink-100',
    title: 'Fast Transcription',
    desc: 'Powered by Groq Whisper — transcribe hours of audio in seconds with high accuracy.',
  },
  {
    icon: Globe,
    color: 'from-cyan-500 to-blue-500',
    bg: 'from-cyan-50 to-blue-50',
    border: 'border-cyan-100',
    title: 'Multi-Language',
    desc: 'Translate transcripts into 50+ languages instantly using advanced AI models.',
  },
  {
    icon: Download,
    color: 'from-orange-400 to-amber-500',
    bg: 'from-orange-50 to-amber-50',
    border: 'border-orange-100',
    title: 'Export Anywhere',
    desc: 'Download your results as TXT, DOC, PDF, or JSON — ready for any workflow.',
  },
]

const STEPS = [
  {
    num: '01',
    icon: Upload,
    color: 'from-violet-500 to-purple-600',
    title: 'Upload Your Audio',
    desc: 'Drop a file or record directly in the browser.',
  },
  {
    num: '02',
    icon: Wand2,
    color: 'from-pink-500 to-rose-500',
    title: 'AI Transcribes It',
    desc: 'Our Whisper-powered engine converts speech to text in seconds.',
  },
  {
    num: '03',
    icon: Languages,
    color: 'from-cyan-500 to-blue-500',
    title: 'Translate & Export',
    desc: 'Translate to any language and export in your preferred format.',
  },
]

const STATS = [
  { value: '50+', label: 'Languages' },
  { value: '99%', label: 'Accuracy' },
  { value: '<10s', label: 'Avg speed' },
  { value: 'Free', label: 'To use' },
]

export default function LandingPage({ onStart }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">

      {/* ── Background Orbs ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="glow-orb absolute -top-32 -left-32 w-[600px] h-[600px] bg-violet-400/20 animate-float" />
        <div className="glow-orb absolute top-1/4 -right-40 w-[500px] h-[500px] bg-pink-400/15 animate-float-alt" />
        <div className="glow-orb absolute bottom-0 left-1/3 w-[550px] h-[550px] bg-cyan-400/12 animate-float" style={{ animationDelay: '3s' }} />
        <div className="glow-orb absolute top-2/3 -left-20 w-[350px] h-[350px] bg-orange-400/10 animate-float-alt" style={{ animationDelay: '5s' }} />
      </div>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-xl bg-white/70 border-b border-white/80 shadow-sm">
      <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-200">
            <Mic size={17} className="text-white" />
          </div>
          <span className="font-extrabold text-slate-900 tracking-tight text-lg">
            VoiceScript <span className="gradient-text">Studio</span>
          </span>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-24 pb-20">
        {/* Pill badge */}
        <div className="animate-fade-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-100 to-pink-100 border border-violet-200 text-violet-700 text-xs font-bold uppercase tracking-widest mb-8 shadow-sm">
          <Sparkles size={11} />
          AI-Powered Audio Intelligence
        </div>

        {/* Headline */}
        <h1 className="animate-fade-up-delay max-w-4xl text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] text-slate-900 text-balance mb-6">
          Transcribe. Translate.{' '}
          <span className="gradient-text">Export.</span>
        </h1>

        {/* Sub */}
        <p className="animate-fade-up-delay2 max-w-xl text-lg text-slate-500 leading-relaxed mb-10 text-balance">
          Turn any audio file into accurate text in seconds. Translate to 50+ languages
          and export in the format you need — all for free.
        </p>

        {/* CTA */}
        <div className="animate-fade-up-delay3 flex flex-col sm:flex-row items-center gap-4">
          <button
            id="hero-start-btn"
            onClick={onStart}
            className="hero-btn group"
          >
            <span>Start Transcribing</span>
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CheckCircle2 size={15} className="text-green-500" />
            No sign-up required
          </div>
        </div>

        {/* Stats row */}
        <div className="animate-fade-up-delay3 mt-16 flex flex-wrap justify-center gap-8 sm:gap-12">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-black gradient-text leading-none">{s.value}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {/* App preview mock */}
        <div className="animate-fade-up-delay3 mt-16 w-full max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden border-2 border-white shadow-[0_32px_80px_rgba(109,40,217,0.15),0_0_0_1px_rgba(255,255,255,0.8)]">
            {/* mock top bar */}
            <div className="bg-white/80 backdrop-blur-xl px-5 py-3 flex items-center gap-2 border-b border-slate-100">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="ml-4 flex-1 h-6 rounded-full bg-slate-100 flex items-center px-3">
                <span className="text-xs text-slate-400 font-mono">voicescript-studio.vercel.app</span>
              </div>
            </div>
            {/* mock content */}
            <div className="bg-gradient-to-br from-slate-50 via-violet-50/30 to-pink-50/20 p-6 min-h-[240px] flex items-center justify-center">
              <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
                {/* mock panels */}
                <div className="col-span-3 bg-white/70 rounded-2xl p-4 border border-white shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <Mic size={18} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="h-3 w-2/3 bg-gradient-to-r from-violet-200 to-pink-200 rounded-full mb-2" />
                    <div className="h-2 w-1/2 bg-slate-100 rounded-full" />
                  </div>
                  <div className="h-8 w-24 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 opacity-80" />
                </div>
                <div className="col-span-2 bg-white/70 rounded-2xl p-4 border border-white shadow-sm">
                  <div className="h-2 w-1/3 bg-violet-200 rounded-full mb-3" />
                  <div className="space-y-1.5">
                    {[0.9, 0.75, 0.85, 0.60, 0.80].map((w, i) => (
                      <div key={i} className="h-2 bg-slate-100 rounded-full" style={{ width: `${w * 100}%` }} />
                    ))}
                  </div>
                </div>
                <div className="bg-white/70 rounded-2xl p-4 border border-white shadow-sm">
                  <div className="h-2 w-1/2 bg-pink-200 rounded-full mb-3" />
                  <div className="space-y-1.5">
                    {[0.8, 0.65, 0.75].map((w, i) => (
                      <div key={i} className="h-2 bg-slate-100 rounded-full" style={{ width: `${w * 100}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
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
          {FEATURES.map((f) => (
            <div key={f.title} className={`feature-card ${f.border}`}>
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 shadow-lg`}>
                <f.icon size={22} className="text-white" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-6 py-20 bg-gradient-to-br from-violet-50/60 via-white/40 to-pink-50/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-bold uppercase tracking-widest mb-4">
              <Sparkles size={11} /> Simple Process
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">
              How it <span className="gradient-text">works</span>
            </h2>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch gap-0 lg:gap-0">
            {STEPS.map((step, i) => (
              <div key={step.num} className="flex-1 flex flex-col lg:flex-row items-center">
                {/* Card */}
                <div className="feature-card flex-1 flex flex-col items-center text-center p-8 w-full">
                  <div className="text-xs font-black tracking-widest text-slate-300 mb-4">{step.num}</div>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-5 shadow-xl`}>
                    <step.icon size={26} className="text-white" />
                  </div>
                  <h3 className="font-black text-slate-900 text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
                {/* Connector */}
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:flex items-center px-3">
                    <ArrowRight size={20} className="text-violet-300 flex-shrink-0" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600 p-12 shadow-[0_24px_80px_rgba(124,58,237,0.35)]">
          {/* inner orbs */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-pink-400/20 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 text-white/90 text-xs font-bold uppercase tracking-widest mb-6 border border-white/20">
              <Zap size={11} fill="currentColor" /> Free & Instant
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
              Ready to transcribe?
            </h2>
            <p className="text-white/75 text-lg mb-8 max-w-md mx-auto">
              No account needed. Just upload your audio and let the AI do the work.
            </p>
            <button
              id="cta-start-btn"
              onClick={onStart}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-white text-violet-700 font-black text-base shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 active:scale-95"
            >
              <FileText size={18} />
              Open VoiceScript Studio
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/60 backdrop-blur-xl bg-white/50 px-6 py-8">
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
