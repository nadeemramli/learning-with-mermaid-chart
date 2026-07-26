import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { breadcrumbPath, buildSearchIndex, buildUniverse } from './universe'

const CONTENT_DIR = resolve(process.cwd(), 'content')

function readContentFiles(): Record<string, string> {
  const files: Record<string, string> = {}
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'staging') continue
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (name.endsWith('.md')) files[relative(CONTENT_DIR, full)] = readFileSync(full, 'utf8')
    }
  }
  walk(CONTENT_DIR)
  return files
}

const manifest = JSON.parse(readFileSync(resolve(CONTENT_DIR, 'manifest.json'), 'utf8'))
const files = readContentFiles()

describe('the real universe', () => {
  const universe = buildUniverse(manifest, files)

  it('loads all systems and derives parents', () => {
    expect(universe.rootId).toBe('economy')
    expect(universe.systems.size).toBe(35)
    expect(universe.systems.get('regulatory-ecosystem')?.parent).toEqual({
      systemId: 'economy',
      nodeId: 'ACC',
    })
    expect(universe.systems.get('fa-architecture')?.parent).toEqual({
      systemId: 'regulatory-ecosystem',
      nodeId: 'REPORTING',
    })
    // The six chapter-level systems hang off the SYS1..SYS6 subgraph containers.
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(universe.systems.get(`fa-sys${n}`)?.parent).toEqual({
        systemId: 'fa-architecture',
        nodeId: `SYS${n}`,
      })
    }
  })

  it('covers all 26 FFA chapters across the six chapter-level systems', () => {
    const chapters = new Set<string>()
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const system = universe.systems.get(`fa-sys${n}`)!
      for (const subgraph of system.diagram.subgraphs) {
        const match = subgraph.id.match(/^CH(\d+)$/)
        if (match) chapters.add(match[1])
      }
    }
    expect([...chapters].map(Number).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 26 }, (_, i) => i + 1),
    )
  })

  it('every chapter subgraph drills into its own chapter-detail system', () => {
    for (let n = 1; n <= 26; n++) {
      const chapter = universe.systems.get(`ch${n}`)
      expect(chapter, `ch${n} missing`).toBeDefined()
      expect(chapter?.parent?.nodeId).toBe(`CH${n}`)
      expect(chapter?.depth).toBe(4)
    }
  })

  it('computes depth and breadcrumbs', () => {
    expect(universe.systems.get('fa-architecture')?.depth).toBe(2)
    const crumbs = breadcrumbPath(universe, 'fa-architecture')
    expect(crumbs.map((s) => s.def.id)).toEqual(['economy', 'regulatory-ecosystem', 'fa-architecture'])
  })

  it('builds a search index spanning all systems', () => {
    const index = buildSearchIndex(universe)
    expect(index.some((e) => e.nodeId === 'IASB' && e.systemId === 'regulatory-ecosystem')).toBe(true)
    expect(index.some((e) => e.nodeId === 'ATB' && e.systemId === 'fa-architecture')).toBe(true)
    expect(index.some((e) => e.kind === 'subgraph' && e.nodeId === 'MALAYSIA')).toBe(true)
  })
})

describe('manifest validation', () => {
  const minimalFiles = { 'a.md': 'flowchart TB\n  N1["node"]\n' }

  it('rejects links to unknown nodes', () => {
    const bad = {
      title: 't', root: 'a',
      systems: {
        a: { title: 'A', file: 'a.md', links: { NOPE: 'b' } },
        b: { title: 'B', file: 'a.md', links: {} },
      },
    }
    expect(() => buildUniverse(bad, minimalFiles)).toThrow(/unknown node "NOPE"/)
  })

  it('rejects links to undefined systems', () => {
    const bad = {
      title: 't', root: 'a',
      systems: { a: { title: 'A', file: 'a.md', links: { N1: 'ghost' } } },
    }
    expect(() => buildUniverse(bad, minimalFiles)).toThrow(/undefined system "ghost"/)
  })

  it('rejects orphan systems unreachable from the root', () => {
    const bad = {
      title: 't', root: 'a',
      systems: {
        a: { title: 'A', file: 'a.md', links: {} },
        orphan: { title: 'O', file: 'a.md', links: {} },
      },
    }
    expect(() => buildUniverse(bad, minimalFiles)).toThrow(/not reachable/)
  })

  it('rejects missing files with a helpful message', () => {
    const bad = { title: 't', root: 'a', systems: { a: { title: 'A', file: 'missing.md', links: {} } } }
    expect(() => buildUniverse(bad, minimalFiles)).toThrow(/missing file "missing.md"/)
  })
})
