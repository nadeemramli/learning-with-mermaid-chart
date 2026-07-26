import { Link } from 'react-router-dom'
import { universe } from '../lib/loadUniverse'
import type { LoadedSystem } from '../lib/universe'

function SystemTree({ system, depth }: { system: LoadedSystem; depth: number }) {
  const children = Object.values(system.childrenByNode)
  return (
    <li style={{ marginLeft: depth * 16 }}>
      <Link to={`/s/${system.def.id}`} className="text-sm hover:underline" style={{ color: 'var(--accent)' }}>
        {system.def.title}
      </Link>
      <ul>
        {children.map((childId) => {
          const child = universe.systems.get(childId)
          return child ? <SystemTree key={childId} system={child} depth={depth + 1} /> : null
        })}
      </ul>
    </li>
  )
}

export default function UnknownSystem() {
  const root = universe.systems.get(universe.rootId)!
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <h1 className="text-lg font-semibold">That system doesn’t exist</h1>
      <p className="text-sm" style={{ color: 'var(--group-title)' }}>
        Pick one from the universe:
      </p>
      <ul>
        <SystemTree system={root} depth={0} />
      </ul>
    </div>
  )
}
