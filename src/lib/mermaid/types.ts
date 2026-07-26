export type EdgeStyle = 'solid' | 'dotted'
export type Direction = 'TB' | 'TD' | 'LR' | 'RL' | 'BT'

export interface DiagramNode {
  id: string
  label: string
  /** Subgraph that owns this node (first-definition rule), or null for top level. */
  subgraphId: string | null
}

export interface DiagramSubgraph {
  id: string
  label: string
  direction: Direction | null
  parentId: string | null
}

export interface DiagramEdge {
  id: string
  /** May reference a node ID or a subgraph ID. */
  source: string
  target: string
  style: EdgeStyle
  label?: string
}

export interface ParsedDiagram {
  direction: Direction
  nodes: DiagramNode[]
  subgraphs: DiagramSubgraph[]
  edges: DiagramEdge[]
}
