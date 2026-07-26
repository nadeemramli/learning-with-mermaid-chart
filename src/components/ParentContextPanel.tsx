import { ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { useEffect, useMemo, useState } from 'react'
import { layoutSystem, type LayoutResult } from '../lib/layout/elkLayout'
import { universe } from '../lib/loadUniverse'
import type { LoadedSystem } from '../lib/universe'
import ElkEdge from './edges/ElkEdge'
import GroupNode from './nodes/GroupNode'
import SystemNode from './nodes/SystemNode'

const nodeTypes = { systemNode: SystemNode, systemGroup: GroupNode }
const edgeTypes = { elk: ElkEdge }

/**
 * Always-visible card showing the PARENT system with the node we entered
 * through pulsing — the "you are here" context. Click = zoom back out.
 */
export default function ParentContextPanel({
  system,
  onZoomOut,
}: {
  system: LoadedSystem
  onZoomOut: () => void
}) {
  const parent = system.parent ? universe.systems.get(system.parent.systemId) : undefined
  if (!parent || !system.parent) return null
  return <Panel parent={parent} entryNodeId={system.parent.nodeId} onZoomOut={onZoomOut} />
}

function Panel({
  parent,
  entryNodeId,
  onZoomOut,
}: {
  parent: LoadedSystem
  entryNodeId: string
  onZoomOut: () => void
}) {
  const [layout, setLayout] = useState<LayoutResult | null>(null)

  useEffect(() => {
    let cancelled = false
    layoutSystem(parent.def.id, parent.diagram, parent.childrenByNode, parent.def.details ?? {}).then((result) => {
      if (!cancelled) setLayout(result)
    })
    return () => {
      cancelled = true
    }
  }, [parent])

  const nodes = useMemo(
    () =>
      layout?.nodes.map((n) =>
        n.id === entryNodeId ? { ...n, data: { ...n.data, highlight: true } } : n,
      ) ?? [],
    [layout, entryNodeId],
  )

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onZoomOut}
      onKeyDown={(e) => e.key === 'Enter' && onZoomOut()}
      className="absolute bottom-4 left-4 z-10 w-72 cursor-zoom-out overflow-hidden rounded-xl border text-left shadow-lg transition-transform hover:scale-[1.02]"
      style={{ background: 'var(--panel-bg)', borderColor: 'var(--node-border)' }}
      title="Zoom out to the parent system"
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-[11px] font-medium"
        style={{ color: 'var(--group-title)' }}
      >
        <span className="truncate">Part of: {parent.def.title}</span>
        <span style={{ color: 'var(--accent)' }}>⤴ zoom out</span>
      </div>
      <div className="pointer-events-none h-40">
        {layout && (
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={layout.edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.05 }}
              minZoom={0.01}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              zoomOnScroll={false}
              zoomOnPinch={false}
              zoomOnDoubleClick={false}
              panOnDrag={false}
              panOnScroll={false}
              preventScrolling={false}
              proOptions={{ hideAttribution: true }}
            />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  )
}
