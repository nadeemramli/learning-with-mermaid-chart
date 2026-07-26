import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { breadcrumbPath, buildSearchIndex, buildUniverse } from './universe'

const CONTENT_DIR = resolve(process.cwd(), 'content')

function readContentFiles(): Record<string, string> {
  const files: Record<string, string> = {}
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
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
    expect(universe.systems.size).toBe(3)
    expect(universe.systems.get('regulatory-ecosystem')?.parent).toEqual({
      systemId: 'economy',
      nodeId: 'ACC',
    })
    expect(universe.systems.get('fa-architecture')?.parent).toEqual({
      systemId: 'regulatory-ecosystem',
      nodeId: 'REPORTING',
    })
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
