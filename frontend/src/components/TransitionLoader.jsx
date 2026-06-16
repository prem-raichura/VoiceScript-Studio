import { useEffect, useState } from 'react'

/* ── Bone primitives ── */
function Bone({ className = '', style }) {
  return (
    <div
      className={`animate-skeleton rounded-xl bg-gradient-to-r from-stone-100 via-stone-200 to-stone-100 bg-[length:400%_100%] ${className}`}
      style={style}
    />
  )
}
function BoneRound({ className = '' }) {
  return (
    <div
      className={`animate-skeleton rounded-full bg-gradient-to-r from-stone-100 via-stone-200 to-stone-100 bg-[length:400%_100%] ${className}`}
    />
  )
}

/* ════════════════════════════════════════════
   SIDEBAR  — matches <aside> in App.jsx exactly
   w-full lg:w-80, border-r, bg-mud-light
   ════════════════════════════════════════════ */
function SidebarSkeleton() {
  return (
    <aside className="relative z-20 w-full lg:w-80 border-r border-mud-base/30 bg-mud-light shadow-sm flex flex-col lg:h-full flex-shrink-0">

      {/* Brand header — p-5, w-10 h-10 rounded-2xl icon, two text lines */}
      <div className="p-5 border-b border-white/60 flex items-center gap-3">
        <Bone className="w-10 h-10 rounded-2xl flex-shrink-0" />
        <div className="flex flex-col gap-2 flex-1">
          <Bone className="h-[14px] w-36" />
          <Bone className="h-[10px] w-24" />
        </div>
      </div>

      {/* LanguageSelector — p-5, two selects + globe icon between them */}
      <div className="p-5 border-b border-white/60">
        {/* label row */}
        <div className="flex items-end gap-3">
          {/* Source select */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <Bone className="h-[10px] w-28 rounded-md" />
            <Bone className="h-10 w-full rounded-xl" />
          </div>
          {/* Globe icon circle — w-7 h-7 rounded-full */}
          <div className="flex-shrink-0 mb-3">
            <BoneRound className="w-7 h-7" />
          </div>
          {/* Target select */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <Bone className="h-[10px] w-20 rounded-md" />
            <Bone className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>

      {/* History area — flex-1 p-5 */}
      <div className="flex-1 p-5 overflow-y-auto scrollbar-thin space-y-3">
        {/* "Recent sessions" label */}
        <div className="flex items-center justify-between px-1">
          <Bone className="h-[10px] w-24 rounded-md" />
          <Bone className="h-[10px] w-12 rounded-md" />
        </div>
        {/* Two history item cards — w-full p-3.5 rounded-xl border */}
        {[0, 1].map(i => (
          <div key={i} className="w-full p-3.5 rounded-xl border border-mud-base/30 bg-mud-light flex items-start gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              <Bone className="h-[11px] w-4/5 rounded-md" />
              <Bone className="h-[10px] w-3/5 rounded-md" />
              <Bone className="h-[9px] w-1/3 rounded-md" />
            </div>
            <Bone className="w-3 h-3 rounded-sm flex-shrink-0 mt-1" />
          </div>
        ))}
      </div>
    </aside>
  )
}

/* ════════════════════════════════════════════
   MAIN  — matches <main> in App.jsx exactly
   flex-1, h-full, overflow-y-auto
   ════════════════════════════════════════════ */
function MainSkeleton() {
  return (
    <main className="relative z-10 flex-1 h-full overflow-y-auto scrollbar-thin flex flex-col">

      {/* Header bar — h-16, hidden on mobile, lg:flex */}
      <div className="h-16 border-b border-mud-base/30 bg-mud-light items-center justify-between px-6 flex-shrink-0 hidden lg:flex">
        <Bone className="h-[11px] w-64 rounded-md" />
        <Bone className="h-8 w-16 rounded-xl" />
      </div>

      {/* Grid — p-4 lg:p-6, grid-cols-1 xl:grid-cols-12, gap-6 */}
      <div className="p-4 lg:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 w-full max-w-7xl mx-auto">

        {/* ── Upload panel — glass-panel p-5 xl:col-span-12 flex lg:flex-row gap-6 ── */}
        <section className="glass-panel p-4 lg:p-5 xl:col-span-12">
          {/* Title */}
          <div className="mb-3 space-y-1.5">
            <Bone className="h-5 w-32 rounded-lg" />
            <Bone className="h-[11px] w-56 rounded-md" />
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:gap-5 items-center">
            {/* Left: URL input skeleton */}
            <div className="w-full md:basis-3/5 md:flex-none space-y-1.5">
              <Bone className="h-[10px] w-20 rounded-md" />
              <div className="flex items-center gap-2">
                <Bone className="h-10 flex-1 rounded-xl" />
                <Bone className="h-9 w-24 rounded-full" />
              </div>
            </div>

            {/* Right: Uploader skeleton */}
            <div className="w-full md:basis-2/5 md:flex-none">
              <div className="rounded-2xl border-2 border-dashed border-mud-base/30 bg-mud-light/60 flex flex-col items-center justify-center gap-2 py-10 px-5">
                <Bone className="w-10 h-10 rounded-xl" />
                <Bone className="h-[13px] w-48 rounded-md" />
                <Bone className="h-[11px] w-36 rounded-md" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Action & Status — xl:col-span-4 flex flex-col gap-6 ── */}
        <section className="xl:col-span-4 flex flex-col gap-6">

          {/* Action buttons panel — glass-panel p-5 space-y-4 */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex flex-col gap-3">
              {/* btn-ghost py-3 — ~44px tall */}
              <Bone className="h-11 w-full rounded-xl" />
              {/* btn-brand py-3 — ~44px tall */}
              <Bone className="h-11 w-full rounded-xl" />
            </div>
          </div>

          {/* Pipeline status panel — glass-panel p-5 space-y-3 */}
          <div className="glass-panel p-5 space-y-3">
            {/* label text-[10px] */}
            <Bone className="h-[10px] w-24 rounded-md" />
            {/* 3 steps — flex items-center gap-3 text-sm */}
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-3">
                {/* icon — size 16 = 1rem */}
                <BoneRound className="w-4 h-4 flex-shrink-0" />
                <Bone className="h-[13px] flex-1 rounded-md" />
              </div>
            ))}
          </div>
        </section>

        {/* ── Transcript Panel — xl:col-span-8 flex flex-col gap-4 ── */}
        <section className="xl:col-span-8 flex flex-col gap-4">

          {/* Transcript section — rounded-2xl border p-5 */}
          <div className="rounded-2xl border border-mud-base/30 bg-mud-light p-5 space-y-3">
            {/* Panel header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bone className="w-5 h-5 rounded-lg flex-shrink-0" />
                <Bone className="h-[10px] w-20 rounded-md" />
              </div>
              {/* Copy button — px-3 py-1.5 rounded-lg text-xs */}
              <Bone className="h-7 w-16 rounded-xl" />
            </div>
            {/* Text lines */}
            <div className="space-y-2">
              {[0.95, 0.80, 0.90, 0.65, 0.82].map((w, i) => (
                <Bone key={i} className="h-[14px] rounded-md" style={{ width: `${w * 100}%` }} />
              ))}
            </div>
          </div>

          {/* Translation section — rounded-2xl border-mud-base/60 bg-mud-base/70 p-5 */}
          <div className="rounded-2xl border border-mud-base/50 bg-mud-base/40 p-5 space-y-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bone className="w-5 h-5 rounded-lg flex-shrink-0" />
                <Bone className="h-[10px] w-24 rounded-md" />
              </div>
            </div>
            <div className="space-y-2">
              {[0.88, 0.72, 0.93, 0.60].map((w, i) => (
                <Bone key={i} className="h-[14px] rounded-md" style={{ width: `${w * 100}%` }} />
              ))}
            </div>
          </div>

        </section>
      </div>
    </main>
  )
}

/* ════════════════════════════════════════════
   ROOT — matches App.jsx outer shell exactly
   min-h-screen lg:h-screen w-full flex flex-col lg:flex-row
   ════════════════════════════════════════════ */
export default function TransitionLoader({ onDone }) {
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setFadeOut(true), 1600)
    const t2 = setTimeout(() => onDone(), 2100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div
      className={`fixed inset-0 z-[9999] transition-opacity duration-500 ease-in-out ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="min-h-screen lg:h-screen w-full bg-transparent relative overflow-hidden text-mud-dark flex flex-col lg:flex-row">
        <SidebarSkeleton />
        <MainSkeleton />
      </div>
    </div>
  )
}
