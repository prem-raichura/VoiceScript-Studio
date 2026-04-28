import { Clock, ChevronRight, History as HistoryIcon } from 'lucide-react'

export default function History({ items, onSelect, onClear }) {
  if (!items.length) return null

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-400 flex items-center gap-1.5">
          <HistoryIcon size={11} /> Recent sessions
        </p>
        <button onClick={onClear} className="text-xs text-gray-300 hover:text-red-400 transition-colors font-medium">
          Clear all
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <button
            key={`${item.timestamp}-${i}`}
            onClick={() => onSelect(item)}
            style={{ animationDelay: `${i * 0.05}s` }}
            className="w-full text-left p-3.5 rounded-xl border border-brand-100 bg-white
                       hover:border-brand-300 hover:bg-brand-50 hover:-translate-y-0.5
                       transition-all duration-200 group flex items-start gap-3 shadow-sm animate-slide-up"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 truncate font-medium">{item.original || '-'}</p>
              <p className="text-xs text-brand-400 truncate mt-0.5 font-medium">{item.translation || '-'}</p>
              <p className="text-[10px] text-gray-300 mt-1 flex items-center gap-1">
                <Clock size={9} /> {item.timestamp}
              </p>
            </div>
            <ChevronRight
              size={13}
              className="text-gray-200 group-hover:text-brand-400 flex-shrink-0 mt-1 transition-colors group-hover:translate-x-0.5 duration-200"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
