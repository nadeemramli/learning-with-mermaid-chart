import type {
  Direction,
  DiagramEdge,
  DiagramNode,
  DiagramSubgraph,
  EdgeStyle,
  ParsedDiagram,
} from './types'

export class ParseError extends Error {
  line: number
  constructor(line: number, message: string) {
    super(`line ${line}: ${message}`)
    this.name = 'ParseError'
    this.line = line
  }
}

/** Extract the first ```mermaid fenced block; pass through if the text has no fence. */
export function extractMermaidBlock(markdown: string): string {
  const match = markdown.match(/```mermaid\r?\n([\s\S]*?)```/)
  return match ? match[1] : markdown
}

const HEADER_RE = /^(?:flowchart|graph)\s+(TB|TD|LR|RL|BT)$/
const SUBGRAPH_RE = /^subgraph\s+(\w+)\s*(?:\[\s*"?(.*?)"?\s*\])?$/
const DIRECTION_RE = /^direction\s+(TB|TD|LR|RL|BT)$/
const NODE_DEF_RE = /^(\w+)\s*\[\s*"(.*)"\s*\]$/

// An edge chain is: endpoint (op endpoint)+ where an endpoint may carry an
// inline node definition, e.g.  D --> B --> L --> U  or  A["x"] --> B
const ENDPOINT_RE = /^(\w+)(?:\s*\[\s*"(.*?)"\s*\])?/
const EDGE_OP_RE =
  /^\s*(?:(-->)|(-\.->)|--\s*"([^"]*)"\s*-->|-\.\s*"([^"]*)"\s*\.->)\s*/

interface ChainLink {
  style: EdgeStyle
  label?: string
}

interface ParsedEndpoint {
  id: string
  label?: string
}

/** Try to read a full edge chain from a line. Returns null if the line is not an edge. */
function tryParseEdgeLine(
  line: string,
): { endpoints: ParsedEndpoint[]; links: ChainLink[] } | null {
  let rest = line
  const first = rest.match(ENDPOINT_RE)
  if (!first) return null
  const endpoints: ParsedEndpoint[] = [{ id: first[1], label: first[2] }]
  const links: ChainLink[] = []
  rest = rest.slice(first[0].length)

  while (true) {
    const op = rest.match(EDGE_OP_RE)
    if (!op) break
    rest = rest.slice(op[0].length)
    const next = rest.match(ENDPOINT_RE)
    if (!next) return null
    if (op[1]) links.push({ style: 'solid' })
    else if (op[2]) links.push({ style: 'dotted' })
    else if (op[3] !== undefined) links.push({ style: 'solid', label: op[3] })
    else links.push({ style: 'dotted', label: op[4] })
    endpoints.push({ id: next[1], label: next[2] })
    rest = rest.slice(next[0].length)
  }

  if (links.length === 0 || rest.trim() !== '') return null
  return { endpoints, links }
}

export function parseFlowchart(source: string): ParsedDiagram {
  const lines = source.split('\n')
  let direction: Direction | null = null
  const nodes = new Map<string, DiagramNode & { implicit: boolean }>()
  const subgraphs = new Map<string, DiagramSubgraph>()
  const edges: DiagramEdge[] = []
  const stack: string[] = []

  const currentSubgraph = () => (stack.length ? stack[stack.length - 1] : null)

  const touchNode = (ep: ParsedEndpoint, lineNo: number) => {
    const existing = nodes.get(ep.id)
    if (ep.label !== undefined) {
      if (!existing || existing.implicit) {
        nodes.set(ep.id, {
          id: ep.id,
          label: ep.label,
          subgraphId: currentSubgraph(),
          implicit: false,
        })
      }
    } else if (!existing && !subgraphs.has(ep.id)) {
      nodes.set(ep.id, {
        id: ep.id,
        label: ep.id,
        subgraphId: currentSubgraph(),
        implicit: true,
      })
    }
    void lineNo
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    const line = lines[i].trim()
    if (line === '' || line.startsWith('%%')) continue

    if (direction === null) {
      const header = line.match(HEADER_RE)
      if (!header) {
        throw new ParseError(lineNo, `expected "flowchart <direction>" header, got "${line}"`)
      }
      direction = header[1] as Direction
      continue
    }

    const sub = line.match(SUBGRAPH_RE)
    if (sub) {
      const [, id, label] = sub
      if (subgraphs.has(id)) throw new ParseError(lineNo, `duplicate subgraph "${id}"`)
      subgraphs.set(id, {
        id,
        label: label ?? id,
        direction: null,
        parentId: currentSubgraph(),
      })
      stack.push(id)
      continue
    }

    if (line === 'end') {
      if (!stack.length) throw new ParseError(lineNo, `"end" without open subgraph`)
      stack.pop()
      continue
    }

    const dir = line.match(DIRECTION_RE)
    if (dir) {
      const open = currentSubgraph()
      if (open) subgraphs.get(open)!.direction = dir[1] as Direction
      continue
    }

    const chain = tryParseEdgeLine(line)
    if (chain) {
      chain.endpoints.forEach((ep) => touchNode(ep, lineNo))
      for (let k = 0; k < chain.links.length; k++) {
        const source = chain.endpoints[k].id
        const target = chain.endpoints[k + 1].id
        edges.push({
          id: `${source}->${target}#${edges.length}`,
          source,
          target,
          style: chain.links[k].style,
          label: chain.links[k].label,
        })
      }
      continue
    }

    const def = line.match(NODE_DEF_RE)
    if (def) {
      touchNode({ id: def[1], label: def[2] }, lineNo)
      continue
    }

    throw new ParseError(lineNo, `unrecognized syntax: "${line}"`)
  }

  if (direction === null) throw new ParseError(lines.length, 'empty diagram: no flowchart header')
  if (stack.length) {
    throw new ParseError(lines.length, `unclosed subgraph "${stack[stack.length - 1]}"`)
  }

  // An edge may mention a subgraph ID before the subgraph is declared; drop the
  // placeholder node created for it.
  for (const id of subgraphs.keys()) nodes.delete(id)

  for (const edge of edges) {
    for (const endpoint of [edge.source, edge.target]) {
      if (!nodes.has(endpoint) && !subgraphs.has(endpoint)) {
        throw new ParseError(0, `edge endpoint "${endpoint}" is not a known node or subgraph`)
      }
    }
  }

  return {
    direction,
    nodes: [...nodes.values()].map(({ implicit: _implicit, ...node }) => node),
    subgraphs: [...subgraphs.values()],
    edges,
  }
}
