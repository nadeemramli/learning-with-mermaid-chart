import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { universe } from '../lib/loadUniverse'
import { buildSearchIndex, type SearchEntry } from '../lib/universe'

let cachedIndex: SearchEntry[] | null = null
const getIndex = () => (cachedIndex ??= buildSearchIndex(universe))

export default function SearchPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  useEffect(() => inputRef.current?.focus(), [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return getIndex()
      .filter((e) => e.label.toLowerCase().includes(q) || e.nodeId.toLowerCase().includes(q))
      .slice(0, 24)
  }, [query])

  const go = (entry: SearchEntry) => {
    onClose()
    navigate(`/s/${entry.systemId}?node=${encodeURIComponent(entry.nodeId)}`)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onClose()
    else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (event.key === 'Enter' && results[cursor]) {
      go(results[cursor])
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[14vh]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[62vh] w-[min(580px,92vw)] flex-col overflow-hidden rounded-xl border shadow-2xl"
        style={{ background: 'var(--panel-bg)', borderColor: 'var(--node-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCursor(0)
          }}
          onKeyDown={onKeyDown}
          placeholder="Search every node in every system…"
          className="border-b bg-transparent px-4 py-3 text-sm outline-none"
          style={{ borderColor: 'var(--node-border)', color: 'var(--node-text)' }}
        />
        <div className="overflow-y-auto">
          {query && results.length === 0 && (
            <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--group-title)' }}>
              No nodes match “{query}”
            </div>
          )}
          {results.map((entry, i) => (
            <button
              key={`${entry.systemId}/${entry.nodeId}`}
              onClick={() => go(entry)}
              onMouseEnter={() => setCursor(i)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-xs"
              style={{ background: i === cursor ? 'var(--accent-soft)' : 'transparent' }}
            >
              <span className="truncate" style={{ color: 'var(--node-text)' }}>
                {entry.kind === 'subgraph' ? '▣ ' : ''}
                {entry.label}
              </span>
              <span className="shrink-0 text-[10px]" style={{ color: 'var(--group-title)' }}>
                {entry.systemTitle}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
