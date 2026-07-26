import { Link } from 'react-router-dom'
import { universe } from '../lib/loadUniverse'
import { breadcrumbPath, type LoadedSystem } from '../lib/universe'
import ThemeToggle from './ThemeToggle'

export default function HeaderBar({
  system,
  onSearch,
}: {
  system: LoadedSystem
  onSearch: () => void
}) {
  const crumbs = breadcrumbPath(universe, system.def.id)

  return (
    <header
      className="z-20 flex h-12 shrink-0 items-center gap-4 border-b px-4"
      style={{ background: 'var(--panel-bg)', borderColor: 'var(--node-border)' }}
    >
      <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
        🧭 {universe.title}
      </span>

      <nav className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-[13px]">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <span key={crumb.def.id} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <span style={{ color: 'var(--group-title)' }}>›</span>}
              {isLast ? (
                <span className="truncate font-semibold">{crumb.def.title}</span>
              ) : (
                <Link
                  to={`/s/${crumb.def.id}`}
                  className="truncate hover:underline"
                  style={{ color: 'var(--group-title)' }}
                >
                  {crumb.def.title}
                </Link>
              )}
            </span>
          )
        })}
      </nav>

      <button
        onClick={onSearch}
        className="flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs"
        style={{ borderColor: 'var(--node-border)', color: 'var(--group-title)' }}
      >
        <span>Search</span>
        <kbd className="rounded border px-1 text-[10px]" style={{ borderColor: 'var(--node-border)' }}>
          ⌘K
        </kbd>
      </button>
      <ThemeToggle />
    </header>
  )
}
