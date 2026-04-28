export default function Waveform({ active = false, bars = 24, height = 32 }) {
  const classes = ['wave-1','wave-2','wave-3','wave-4','wave-5','wave-6']
  return (
    <div className="flex items-center gap-[2px]" style={{ height }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`wave-bar transition-all duration-300 ${active ? classes[i % 6] : ''}`}
          style={{
            height: active ? '100%' : `${15 + ((i * 7 + i * i * 3) % 60)}%`,
            opacity: active ? 1 : 0.2,
            minHeight: 3,
          }}
        />
      ))}
    </div>
  )
}
