import type { ElkNode } from 'elkjs/lib/elk.bundled.js'
import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { ParsedDiagram } from '../mermaid/types'

export interface SystemNodeData extends Record<string, unknown> {
  label: string
  kind: 'node' | 'group'
  /** Present when this node drills down into a child system. */
  childId?: string
  highlight?: boolean
}

export type AppNode = Node<SystemNodeData>

export interface LayoutResult {
  nodes: AppNode[]
  edges: Edge[]
}

export function wrapLabel(label: string, maxChars = 26): string[] {
  const words = label.split(/\s+/)
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
}

export function estimateNodeSize(label: string): { width: number; height: number } {
  const lines = wrapLabel(label)
  const longest = Math.max(...lines.map((l) => l.length))
  return {
    width: Math.min(232, Math.max(96, Math.round(longest * 7.4) + 36)),
    height: lines.length * 17 + 24,
  }
}

const ROOT_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '48',
  'elk.spacing.nodeNode': '28',
  'elk.spacing.componentComponent': '56',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
}

const SUBGRAPH_OPTIONS: Record<string, string> = {
  'elk.padding': '[top=54,left=20,bottom=20,right=20]',
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
      layoutOptions: SUBGRAPH_OPTIONS,
      children: buildChildren(s.id),
    })),
    ...(nodesBySubgraph.get(parentId) ?? []).map((n) => ({
      id: n.id,
      ...estimateNodeSize(n.label),
    })),
  ]

  // elkjs is ~1.4 MB — load it only when a layout is first needed.
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
  const elk = new ELK()
  const laidOut = await elk.layout({
    id: 'root',
    layoutOptions: { ...ROOT_OPTIONS, 'elk.direction': elkDirection(diagram.direction) },
    children: buildChildren(null),
    edges: diagram.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  })

  const rfNodes: AppNode[] = []
  const walk = (elkNode: ElkNode, parentId?: string) => {
    for (const child of elkNode.children ?? []) {
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
        walk(child, child.id)
      } else {
        const label = diagram.nodes.find((n) => n.id === child.id)?.label ?? child.id
        rfNodes.push({
          ...base,
          type: 'systemNode',
          data: { label, kind: 'node', childId: links[child.id] },
        })
      }
    }
  }
  walk(laidOut)

  const rfEdges: Edge[] = diagram.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'smoothstep',
    label: e.label,
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
): Promise<LayoutResult> {
  let cached = layoutCache.get(systemId)
  if (!cached) {
    cached = computeLayout(diagram, links)
    layoutCache.set(systemId, cached)
  }
  return cached
}
