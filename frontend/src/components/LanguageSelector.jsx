import { ChevronDown, Globe } from 'lucide-react'

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ko', label: 'Korean' },
  { code: 'it', label: 'Italian' },
]

export const SOURCE_LANGUAGES = [
  { code: 'auto', label: 'Auto-detect' },
  ...LANGUAGES,
]

function Select({ value, onChange, options, disabled, label }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-[10px] font-bold text-mud-dark mb-1.5 uppercase tracking-widest">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="input-select pr-8 font-semibold"
        >
          {options.map((o) => (
            <option key={o.code} value={o.code}>{o.label}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-mud-dark/80">
          <ChevronDown size={14} />
        </div>
      </div>
    </div>
  )
}

export default function LanguageSelector({
  sourceLang,
  targetLang,
  onSourceChange,
  onTargetChange,
  disabled,
}) {
  return (
    <div className="flex items-end gap-3">
      <Select
        label="Transcribe language"
        value={sourceLang}
        onChange={onSourceChange}
        options={SOURCE_LANGUAGES}
        disabled={disabled}
      />
      <div className="flex-shrink-0 mb-3 flex flex-col items-center gap-0.5">
        <div className="w-7 h-7 rounded-full bg-mud-light border border-mud-base/30 flex items-center justify-center">
          <Globe size={12} className="text-mud-dark animate-rotate-slow" />
        </div>
      </div>
      <Select
        label="Translate to"
        value={targetLang}
        onChange={onTargetChange}
        options={LANGUAGES}
        disabled={disabled}
      />
    </div>
  )
}