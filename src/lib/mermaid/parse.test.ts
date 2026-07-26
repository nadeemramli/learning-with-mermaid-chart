import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ParseError, extractMermaidBlock, parseFlowchart } from './parse'

const CONTENT_DIR = resolve(process.cwd(), 'content')
const load = (file: string) =>
  parseFlowchart(extractMermaidBlock(readFileSync(resolve(CONTENT_DIR, file), 'utf8')))

describe('regulatory-ecosystem.md (real fixture)', () => {
  const diagram = load('accounting/regulatory-ecosystem.md')

  it('extracts the exact inventory: 102 nodes, 9 subgraphs, 129 edges', () => {
    expect(diagram.nodes).toHaveLength(102)
    expect(diagram.subgraphs).toHaveLength(9)
    expect(diagram.edges).toHaveLength(129)
  })

  it('distinguishes solid from dotted edges (116 / 13)', () => {
    expect(diagram.edges.filter((e) => e.style === 'solid')).toHaveLength(116)
    expect(diagram.edges.filter((e) => e.style === 'dotted')).toHaveLength(13)
  })

  it('assigns ownership by first definition, not edge declaration site', () => {
    const byId = new Map(diagram.nodes.map((n) => [n.id, n]))
    expect(byId.get('IASB')?.subgraphId).toBe('GLOBAL')
    // NAS --> EXT is declared inside ASSURANCE, but NAS is defined in SOVEREIGN
    expect(byId.get('NAS')?.subgraphId).toBe('SOVEREIGN')
    // INT --> BOARD is declared inside ASSURANCE, but BOARD is defined in ENTITY
    expect(byId.get('BOARD')?.subgraphId).toBe('ENTITY')
    // IFAMILY -.-> NSS is declared inside SOVEREIGN, but IFAMILY belongs to GLOBAL
    expect(byId.get('IFAMILY')?.subgraphId).toBe('GLOBAL')
  })

  it('parses edges whose endpoints are subgraph IDs', () => {
    expect(
      diagram.edges.some((e) => e.source === 'GLOBAL' && e.target === 'P' && e.style === 'dotted'),
    ).toBe(true)
    expect(
      diagram.edges.some((e) => e.source === 'SOVEREIGN' && e.target === 'MYP' && e.style === 'dotted'),
    ).toBe(true)
    expect(diagram.nodes.some((n) => n.id === 'GLOBAL')).toBe(false)
  })

  it('resolves every edge endpoint to a known node or subgraph', () => {
    const known = new Set([
      ...diagram.nodes.map((n) => n.id),
      ...diagram.subgraphs.map((s) => s.id),
    ])
    for (const edge of diagram.edges) {
      expect(known.has(edge.source)).toBe(true)
      expect(known.has(edge.target)).toBe(true)
    }
  })
})

describe('fa-architecture.md (real fixture)', () => {
  const diagram = load('accounting/fa-architecture.md')

  it('parses 6 subgraphs with their long labels intact', () => {
    expect(diagram.subgraphs).toHaveLength(6)
    expect(diagram.subgraphs.map((s) => s.id)).toEqual([
      'SYS1', 'SYS2', 'SYS3', 'SYS4', 'SYS5', 'SYS6',
    ])
    expect(diagram.subgraphs[0].label).toBe('SYSTEM 1 — WHY ACCOUNTING EXISTS')
  })

  it('parses dotted edges with labels', () => {
    const edge = diagram.edges.find((e) => e.source === 'C4' && e.target === 'M')
    expect(edge?.style).toBe('dotted')
    expect(edge?.label).toBe('Recognition and measurement rules')
  })

  it('parses chained edges (D --> B --> L --> U) into individual edges', () => {
    const pairs = diagram.edges.map((e) => `${e.source}->${e.target}`)
    expect(pairs).toContain('D->B')
    expect(pairs).toContain('B->L')
    expect(pairs).toContain('L->U')
  })

  it('parses inline node definitions inside edge lines (S11 --> C["..."])', () => {
    const c = diagram.nodes.find((n) => n.id === 'C')
    expect(c?.label).toBe('REPORTING CONSTITUTION')
    expect(c?.subgraphId).toBe('SYS1')
  })

  it('respects per-subgraph direction (SYS2 is LR)', () => {
    expect(diagram.subgraphs.find((s) => s.id === 'SYS2')?.direction).toBe('LR')
  })
})

describe('error handling', () => {
  it('reports unclosed subgraphs', () => {
    expect(() => parseFlowchart('flowchart TB\nsubgraph X["x"]\nA["a"]')).toThrow(/unclosed subgraph "X"/)
  })

  it('reports unknown syntax with line numbers', () => {
    try {
      parseFlowchart('flowchart TB\nA["ok"]\nA ==> B')
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError)
      expect((err as ParseError).line).toBe(3)
    }
  })

  it('rejects a missing flowchart header', () => {
    expect(() => parseFlowchart('A --> B')).toThrow(/flowchart/)
  })
})

describe('extractMermaidBlock', () => {
  it('strips the fence and passes through unfenced text', () => {
    expect(extractMermaidBlock('# md\n```mermaid\nflowchart TB\n```\ntrailing')).toBe('flowchart TB\n')
    expect(extractMermaidBlock('flowchart TB')).toBe('flowchart TB')
  })
})
