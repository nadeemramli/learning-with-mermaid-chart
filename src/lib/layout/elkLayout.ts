import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk.bundled.js'
import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { ParsedDiagram } from '../mermaid/types'

export interface SystemNodeData extends Record<string, unknown> {
  label: string
  kind: 'node' | 'group'
  /** Present when this node drills down into a child system. */
  childId?: string
  /** Full descriptive text rendered inside the node, under the label. */
  detail?: string
  highlight?: boolean
}

export type AppNode = Node<SystemNodeData>

export interface LayoutResult {
  nodes: AppNode[]
  edges: Edge[]
}

export function wrapLabel(label: string, maxChars = 26): string[] {
  // Explicit newlines (from mermaid <br/>) are hard breaks; wrap each segment.
  return label.split('\n').flatMap((segment) => {
    const words = segment.split(/\s+/).filter(Boolean)
    if (!words.length) return ['']
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      if (current && (current + ' ' + word).length > maxChars) {
        lines.push(current)
        current = word
      } else {
        current = current ? current + ' ' + word : word
      }
    }
    if (current) lines.push(current)
    return lines
  })
}

export function estimateNodeSize(label: string, detail?: string): { width: number; height: number } {
  const lines = wrapLabel(label)
  const longest = Math.max(...lines.map((l) => l.length))
  if (!detail) {
    return {
      width: Math.min(232, Math.max(96, Math.round(longest * 7.4) + 36)),
      height: lines.length * 17 + 24,
    }
  }
  // Detail nodes are wider and grow with the inline text block.
  const detailLines = wrapLabel(detail, 48)
  return {
    width: 264,
    height: lines.length * 17 + 24 + detailLines.length * 13 + 12,
  }
}

const ROOT_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.spacing.nodeNodeBetweenLayers': '52',
  'elk.layered.spacing.edgeNodeBetweenLayers': '24',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
  'elk.spacing.nodeNode': '28',
  'elk.spacing.edgeNode': '18',
  'elk.spacing.edgeEdge': '10',
  'elk.spacing.componentComponent': '56',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  // Break feedback cycles greedily but use declaration order as tie-breaker,
  // so the file's pedagogical sequence (system 1 → 6) sets the reading
  // direction without distorting simpler diagrams.
  'elk.layered.cycleBreaking.strategy': 'GREEDY_MODEL_ORDER',
}

function subgraphOptions(label: string): Record<string, string> {
  // Reserve enough header space for the title to wrap without clipping.
  const titleLines = Math.max(1, Math.ceil(label.length / 34))
  return { 'elk.padding': `[top=${28 + titleLines * 17},left=20,bottom=20,right=20]` }
}

function elkDirection(direction: ParsedDiagram['direction']): string {
  switch (direction) {
    case 'LR': return 'RIGHT'
    case 'RL': return 'LEFT'
    case 'BT': return 'UP'
    default: return 'DOWN'
  }
}

async function computeLayout(
  diagram: ParsedDiagram,
  links: Record<string, string>,
  details: Record<string, string>,
  layoutOverrides: Record<string, string>,
): Promise<LayoutResult> {
  const nodesBySubgraph = new Map<string | null, typeof diagram.nodes>()
  for (const node of diagram.nodes) {
    const list = nodesBySubgraph.get(node.subgraphId) ?? []
    list.push(node)
    nodesBySubgraph.set(node.subgraphId, list)
  }
  const subgraphsByParent = new Map<string | null, typeof diagram.subgraphs>()
  for (const subgraph of diagram.subgraphs) {
    const list = subgraphsByParent.get(subgraph.parentId) ?? []
    list.push(subgraph)
    subgraphsByParent.set(subgraph.parentId, list)
  }
  const subgraphById = new Map(diagram.subgraphs.map((s) => [s.id, s]))

  const buildChildren = (parentId: string | null): ElkNode[] => [
    ...(subgraphsByParent.get(parentId) ?? []).map((s) => ({
      id: s.id,
      layoutOptions: subgraphOptions(s.label),
      children: buildChildren(s.id),
    })),
    ...(nodesBySubgraph.get(parentId) ?? []).map((n) => ({
      id: n.id,
      ...estimateNodeSize(n.label, details[n.id]),
    })),
  ]

  // elkjs is ~1.4 MB — load it only when a layout is first needed.
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
  const elk = new ELK()
  const laidOut = await elk.layout({
    id: 'root',
    layoutOptions: {
      ...ROOT_OPTIONS,
      'elk.direction': elkDirection(diagram.direction),
      ...layoutOverrides,
    },
    children: buildChildren(null),
    edges: diagram.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  })

  const rfNodes: AppNode[] = []
  // Absolute canvas position of every ELK node, needed to translate ELK's
  // edge routes (which are relative to each edge's container) to canvas space.
  const absById = new Map<string, { x: number; y: number }>()
  absById.set('root', { x: 0, y: 0 })
  const walk = (elkNode: ElkNode, parentAbs: { x: number; y: number }, parentId?: string) => {
    for (const child of elkNode.children ?? []) {
      const abs = { x: parentAbs.x + (child.x ?? 0), y: parentAbs.y + (child.y ?? 0) }
      absById.set(child.id, abs)
      const subgraph = subgraphById.get(child.id)
      const base = {
        id: child.id,
        position: { x: child.x ?? 0, y: child.y ?? 0 },
        width: child.width,
        height: child.height,
        draggable: false,
        connectable: false,
        ...(parentId ? { parentId, extent: 'parent' as const } : {}),
      }
      if (subgraph) {
        rfNodes.push({
          ...base,
          type: 'systemGroup',
          selectable: true,
          data: { label: subgraph.label, kind: 'group', childId: links[subgraph.id] },
        })
        walk(child, abs, child.id)
      } else {
        const label = diagram.nodes.find((n) => n.id === child.id)?.label ?? child.id
        rfNodes.push({
          ...base,
          type: 'systemNode',
          data: { label, kind: 'node', childId: links[child.id], detail: details[child.id] },
        })
      }
    }
  }
  walk(laidOut, { x: 0, y: 0 })

  const pointsByEdgeId = new Map<string, Array<{ x: number; y: number }>>()
  for (const rawEdge of laidOut.edges ?? []) {
    const elkEdge = rawEdge as ElkExtendedEdge
    const containerId = (elkEdge as unknown as { container?: string }).container ?? 'root'
    const offset = absById.get(containerId) ?? { x: 0, y: 0 }
    const points: Array<{ x: number; y: number }> = []
    for (const section of elkEdge.sections ?? []) {
      for (const p of [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]) {
        points.push({ x: p.x + offset.x, y: p.y + offset.y })
      }
    }
    pointsByEdgeId.set(elkEdge.id, points)
  }

  const rfEdges: Edge[] = diagram.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'elk',
    data: { points: pointsByEdgeId.get(e.id) ?? [], label: e.label },
    className: e.style === 'dotted' ? 'edge-dotted' : 'edge-solid',
    style: e.style === 'dotted' ? { strokeDasharray: '6 4' } : undefined,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 15,
      height: 15,
      color: e.style === 'dotted' ? 'var(--edge-muted)' : 'var(--edge)',
    },
  }))

  return { nodes: rfNodes, edges: rfEdges }
}

const layoutCache = new Map<string, Promise<LayoutResult>>()

/** Layout is deterministic per system; memoize so navigation revisits are instant. */
export function layoutSystem(
  systemId: string,
  diagram: ParsedDiagram,
  links: Record<string, string>,
  details: Record<string, string> = {},
  layoutOverrides: Record<string, string> = {},
): Promise<LayoutResult> {
  let cached = layoutCache.get(systemId)
  if (!cached) {
    cached = computeLayout(diagram, links, details, layoutOverrides)
    layoutCache.set(systemId, cached)
  }
  return cached
}
