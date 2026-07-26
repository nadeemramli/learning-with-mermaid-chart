import { useMemo } from 'react'
import { universe } from '../lib/loadUniverse'
import type { LoadedSystem } from '../lib/universe'
import { useDrill } from './drillContext'

export default function NodeDetailPanel({
  system,
  nodeId,
  onClose,
}: {
  system: LoadedSystem
  nodeId: string
  onClose: () => void
}) {
  const drill = useDrill()

  const node = system.diagram.nodes.find((n) => n.id === nodeId)
  const subgraph = system.diagram.subgraphs.find((s) => s.id === nodeId)
  const label = node?.label ?? subgraph?.label ?? nodeId
  const ownerLabel = node?.subgraphId
    ? system.diagram.subgraphs.find((s) => s.id === node.subgraphId)?.label
    : null
  const note = system.def.notes?.[nodeId]
  const childId = system.childrenByNode[nodeId]
  const child = childId ? universe.systems.get(childId) : undefined

  const resolveLabel = (id: string) =>
    system.diagram.nodes.find((n) => n.id === id)?.label ??
    system.diagram.subgraphs.find((s) => s.id === id)?.label ??
    id

  const { inbound, outbound } = useMemo(
    () => ({
      inbound: system.diagram.edges.filter((e) => e.target === nodeId),
      outbound: system.diagram.edges.filter((e) => e.source === nodeId),
    }),
    [system, nodeId],
  )

  return (
    <aside
      className="absolute top-4 right-4 bottom-4 z-10 flex w-80 flex-col gap-3 overflow-y-auto rounded-xl border p-4 shadow-xl"
      style={{ background: 'var(--panel-bg)', borderColor: 'var(--node-border)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--group-title)' }}>
            {subgraph ? 'Subsystem' : 'Node'} · {nodeId}
          </div>
          <h2 className="mt-1 text-sm leading-snug font-semibold">{label}</h2>
          {ownerLabel && (
            <div className="mt-1 text-[11px]" style={{ color: 'var(--group-title)' }}>
              Within: {ownerLabel}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-1.5 text-sm"
          style={{ color: 'var(--group-title)' }}
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {child && (
        <button
          onClick={() => drill(nodeId)}
          className="rounded-lg px-3 py-2 text-left text-xs font-semibold text-white shadow"
          style={{ background: 'var(--accent)' }}
        >
          ⤵ Enter system: {child.def.title}
        </button>
      )}

      {note && (
        <p
          className="rounded-lg border p-3 text-xs leading-relaxed"
          style={{ borderColor: 'var(--node-border)', color: 'var(--node-text)' }}
        >
          {note}
        </p>
      )}

      {(inbound.length > 0 || outbound.length > 0) && (
        <div className="flex flex-col gap-2 text-[11px]">
          {inbound.length > 0 && (
            <div>
              <div className="mb-1 font-semibold" style={{ color: 'var(--group-title)' }}>
                ← Fed by
              </div>
              {inbound.slice(0, 8).map((e) => (
                <div key={e.id} className="truncate py-0.5" title={resolveLabel(e.source)}>
                  {e.style === 'dotted' ? '⇢ ' : '→ '}
                  {resolveLabel(e.source)}
                  {e.label ? ` — ${e.label}` : ''}
                </div>
              ))}
              {inbound.length > 8 && (
                <div style={{ color: 'var(--group-title)' }}>+{inbound.length - 8} more</div>
              )}
            </div>
          )}
          {outbound.length > 0 && (
            <div>
              <div className="mb-1 font-semibold" style={{ color: 'var(--group-title)' }}>
                → Feeds into
              </div>
              {outbound.slice(0, 8).map((e) => (
                <div key={e.id} className="truncate py-0.5" title={resolveLabel(e.target)}>
                  {e.style === 'dotted' ? '⇢ ' : '→ '}
                  {resolveLabel(e.target)}
                  {e.label ? ` — ${e.label}` : ''}
                </div>
              ))}
              {outbound.length > 8 && (
                <div style={{ color: 'var(--group-title)' }}>+{outbound.length - 8} more</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-auto pt-2 text-[10px]" style={{ color: 'var(--group-title)' }}>
        Dotted arrows (⇢) mean influence without direct authority.
      </div>
    </aside>
  )
}
