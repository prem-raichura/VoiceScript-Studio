import { Clock, ChevronRight, History as HistoryIcon } from 'lucide-react'

export default function History({ items, onSelect, onClear }) {
  if (!items.length) return null

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-mud-dark flex items-center gap-1.5">
          <HistoryIcon size={11} /> Recent sessions
        </p>
        <button onClick={onClear} className="text-xs text-mud-dark/90 hover:text-mud-clay transition-colors font-medium">
          Clear all
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <button
            key={`${item.timestamp}-${i}`}
            onClick={() => onSelect(item)}
            style={{ animationDelay: `${i * 0.05}s` }}
            className="w-full text-left p-3.5 rounded-xl border border-mud-base/30 bg-mud-light
                       hover:border-mud-base/50 hover:bg-mud-light hover:-transtone-y-0.5
                       transition-all duration-200 group flex items-start gap-3 shadow-sm animate-slide-up"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-mud-dark/90 truncate font-medium">{item.original || '-'}</p>
              <p className="text-xs text-mud-dark truncate mt-0.5 font-medium">{item.translation || '-'}</p>
              <p className="text-[10px] text-mud-dark/90 mt-1 flex items-center gap-1">
                <Clock size={9} /> {item.timestamp}
              </p>
            </div>
            <ChevronRight
              size={13}
              className="text-mud-dark group-hover:text-mud-dark flex-shrink-0 mt-1 transition-colors group-hover:transtone-x-0.5 duration-200"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
