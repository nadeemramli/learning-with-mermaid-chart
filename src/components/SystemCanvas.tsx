import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeMouseHandler,
  type Rect,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { layoutSystem, type AppNode, type LayoutResult } from '../lib/layout/elkLayout'
import type { LoadedSystem } from '../lib/universe'
import ElkEdge from './edges/ElkEdge'
import GroupNode from './nodes/GroupNode'
import SystemNode from './nodes/SystemNode'

const nodeTypes = { systemNode: SystemNode, systemGroup: GroupNode }
const edgeTypes = { elk: ElkEdge }

interface Props {
  system: LoadedSystem
  entry: 'in' | 'out' | null
  focusNode: string | null
  onSelectNode: (id: string | null) => void
  registerDrill: (fn: (nodeId: string) => void) => void
}

function pad(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  }
}

function Canvas({ system, entry, focusNode, onSelectNode, registerDrill }: Props) {
  const rf = useReactFlow()
  const navigate = useNavigate()
  const [layout, setLayout] = useState<LayoutResult | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(focusNode)
  const [fading, setFading] = useState(false)
  const initialised = useRef(false)

  useEffect(() => {
    let cancelled = false
    layoutSystem(system.def.id, system.diagram, system.childrenByNode).then((result) => {
      if (!cancelled) setLayout(result)
    })
    return () => {
      cancelled = true
    }
  }, [system])

  const nodeBounds = useCallback(
    (nodeId: string): Rect | null => {
      const internal = rf.getInternalNode(nodeId)
      if (!internal) return null
      return {
        x: internal.internals.positionAbsolute.x,
        y: internal.internals.positionAbsolute.y,
        width: internal.measured.width ?? internal.width ?? 200,
        height: internal.measured.height ?? internal.height ?? 60,
      }
    },
    [rf],
  )

  // Entry animation on mount + focus animation when a search/deep-link target changes.
  useEffect(() => {
    if (!layout) return
    const timer = window.setTimeout(() => {
      if (!initialised.current) {
        initialised.current = true
        // Viewport calls must be chained: a second call in the same tick
        // cancels the first one's animation.
        if (entry === 'in') {
          // The parent node just "unfolded": start close-up, settle out to full view.
          void rf
            .fitView({ padding: 0.1, duration: 0 })
            .then(() => rf.zoomTo(rf.getZoom() * 1.55, { duration: 0 }))
            .then(() => rf.fitView({ padding: 0.1, duration: 550 }))
        } else if (focusNode) {
          const bounds = nodeBounds(focusNode)
          if (bounds && entry === 'out') {
            // Returning to the parent: start tight on the node we came out of, pull back.
            void rf
              .fitBounds(pad(bounds, 80), { duration: 0 })
              .then(() => rf.fitView({ padding: 0.1, duration: 600 }))
          } else if (bounds) {
            void rf
              .fitView({ padding: 0.1, duration: 0 })
              .then(() => rf.fitBounds(pad(bounds, 160), { duration: 550 }))
          } else {
            rf.fitView({ padding: 0.1, duration: 0 })
          }
        } else {
          rf.fitView({ padding: 0.1, duration: 0 })
        }
      } else if (focusNode) {
        setHighlightId(focusNode)
        const bounds = nodeBounds(focusNode)
        if (bounds) void rf.fitBounds(pad(bounds, 160), { duration: 550 })
      }
    }, 60)
    return () => window.clearTimeout(timer)
  }, [layout, focusNode, entry, rf, nodeBounds])

  const drill = useCallback(
    (nodeId: string) => {
      const childId = system.childrenByNode[nodeId]
      if (!childId) return
      const bounds = nodeBounds(nodeId)
      setFading(true)
      if (bounds) rf.fitBounds(pad(bounds, 30), { duration: 340 })
      window.setTimeout(() => navigate(`/s/${childId}`, { state: { entry: 'in' } }), 370)
    },
    [system, rf, navigate, nodeBounds],
  )

  useEffect(() => {
    registerDrill(drill)
  }, [registerDrill, drill])

  const displayNodes = useMemo<AppNode[]>(() => {
    if (!layout) return []
    if (!highlightId) return layout.nodes
    return layout.nodes.map((n) =>
      n.id === highlightId ? { ...n, data: { ...n.data, highlight: true } } : n,
    )
  }, [layout, highlightId])

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      setHighlightId(null)
      onSelectNode(node.id)
    },
    [onSelectNode],
  )

  const onPaneClick = useCallback(() => {
    setHighlightId(null)
    onSelectNode(null)
  }, [onSelectNode])

  if (!layout) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--group-title)' }}>
        Laying out {system.def.title}…
      </div>
    )
  }

  return (
    <div className={`canvas-enter canvas-fade h-full w-full ${fading ? 'is-fading' : ''}`}>
      <ReactFlow
        nodes={displayNodes}
        edges={layout.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.05}
        maxZoom={2.5}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        selectNodesOnDrag={false}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="var(--canvas-dots)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

export default function SystemCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}
