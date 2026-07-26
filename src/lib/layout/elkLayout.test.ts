import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractMermaidBlock, parseFlowchart } from '../mermaid/parse'
import { layoutSystem } from './elkLayout'

const CONTENT_DIR = resolve(process.cwd(), 'content')

describe('elk layout of the real regulatory-ecosystem diagram', () => {
  it('produces finite positions, parents before children, and all edges', async () => {
    const diagram = parseFlowchart(
      extractMermaidBlock(readFileSync(resolve(CONTENT_DIR, 'accounting/regulatory-ecosystem.md'), 'utf8')),
    )
    const { nodes, edges } = await layoutSystem('test-ecosystem', diagram, { REPORTING: 'fa-architecture' })

    expect(nodes).toHaveLength(102 + 9)
    expect(edges).toHaveLength(129)

    const seen = new Set<string>()
    for (const node of nodes) {
      expect(Number.isFinite(node.position.x)).toBe(true)
      expect(Number.isFinite(node.position.y)).toBe(true)
      expect(node.width).toBeGreaterThan(0)
      expect(node.height).toBeGreaterThan(0)
      if (node.parentId) expect(seen.has(node.parentId)).toBe(true)
      seen.add(node.id)
    }

    const reporting = nodes.find((n) => n.id === 'REPORTING')
    expect(reporting?.type).toBe('systemGroup')
    expect(reporting?.data.childId).toBe('fa-architecture')

    // Every edge must carry an ELK-routed polyline with finite coordinates.
    for (const edge of edges) {
      const points = (edge.data?.points ?? []) as Array<{ x: number; y: number }>
      expect(points.length).toBeGreaterThanOrEqual(2)
      for (const p of points) {
        expect(Number.isFinite(p.x)).toBe(true)
        expect(Number.isFinite(p.y)).toBe(true)
      }
    }
  })
})
