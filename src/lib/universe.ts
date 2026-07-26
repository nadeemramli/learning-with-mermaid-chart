import { extractMermaidBlock, parseFlowchart } from './mermaid/parse'
import type { ParsedDiagram } from './mermaid/types'

export interface SystemDef {
  id: string
  title: string
  file: string
  /** nodeId (or subgraphId) in this system's diagram → child system id */
  links: Record<string, string>
  notes?: Record<string, string>
}

export interface LoadedSystem {
  def: SystemDef
  diagram: ParsedDiagram
  parent: { systemId: string; nodeId: string } | null
  childrenByNode: Record<string, string>
  depth: number
}

export interface Universe {
  title: string
  rootId: string
  systems: Map<string, LoadedSystem>
}

interface ManifestShape {
  title: string
  root: string
  systems: Record<string, { title: string; file: string; links: Record<string, string>; notes?: Record<string, string> }>
}

export function buildUniverse(manifest: ManifestShape, filesByPath: Record<string, string>): Universe {
  const systems = new Map<string, LoadedSystem>()

  for (const [id, entry] of Object.entries(manifest.systems)) {
    const raw = filesByPath[entry.file]
    if (raw === undefined) {
      throw new Error(
        `manifest: system "${id}" points to missing file "${entry.file}" (available: ${Object.keys(filesByPath).join(', ')})`,
      )
    }
    let diagram: ParsedDiagram
    try {
      diagram = parseFlowchart(extractMermaidBlock(raw))
    } catch (err) {
      throw new Error(`failed to parse "${entry.file}" (system "${id}"): ${(err as Error).message}`)
    }
    systems.set(id, {
      def: { id, ...entry },
      diagram,
      parent: null,
      childrenByNode: entry.links,
      depth: 0,
    })
  }

  if (!systems.has(manifest.root)) {
    throw new Error(`manifest: root "${manifest.root}" is not a defined system`)
  }

  // Validate notes: every key must be a real node or subgraph, or the note
  // would silently never be shown.
  for (const system of systems.values()) {
    for (const nodeId of Object.keys(system.def.notes ?? {})) {
      const known =
        system.diagram.nodes.some((n) => n.id === nodeId) ||
        system.diagram.subgraphs.some((s) => s.id === nodeId)
      if (!known) {
        throw new Error(
          `manifest: system "${system.def.id}" has a note for unknown node "${nodeId}"`,
        )
      }
    }
  }

  // Validate links and derive parents.
  for (const system of systems.values()) {
    for (const [nodeId, childId] of Object.entries(system.def.links)) {
      const knownEndpoint =
        system.diagram.nodes.some((n) => n.id === nodeId) ||
        system.diagram.subgraphs.some((s) => s.id === nodeId)
      if (!knownEndpoint) {
        throw new Error(
          `manifest: system "${system.def.id}" links unknown node "${nodeId}" — not a node or subgraph in ${system.def.file}`,
        )
      }
      const child = systems.get(childId)
      if (!child) {
        throw new Error(`manifest: system "${system.def.id}" links "${nodeId}" to undefined system "${childId}"`)
      }
      if (child.parent) {
        throw new Error(
          `manifest: system "${childId}" has two parents ("${child.parent.systemId}" and "${system.def.id}")`,
        )
      }
      child.parent = { systemId: system.def.id, nodeId }
    }
  }

  // Reachability + depth from root (also detects cycles: a cycle is unreachable
  // from the root since every system has at most one parent).
  const visited = new Set<string>()
  const queue: Array<{ id: string; depth: number }> = [{ id: manifest.root, depth: 0 }]
  while (queue.length) {
    const { id, depth } = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const system = systems.get(id)!
    system.depth = depth
    for (const childId of Object.values(system.def.links)) {
      queue.push({ id: childId, depth: depth + 1 })
    }
  }
  for (const id of systems.keys()) {
    if (!visited.has(id)) {
      throw new Error(`manifest: system "${id}" is not reachable from root "${manifest.root}"`)
    }
  }

  return { title: manifest.title, rootId: manifest.root, systems }
}

/** Ancestor chain from the root down to (and including) systemId. */
export function breadcrumbPath(universe: Universe, systemId: string): LoadedSystem[] {
  const path: LoadedSystem[] = []
  let current = universe.systems.get(systemId)
  while (current) {
    path.unshift(current)
    current = current.parent ? universe.systems.get(current.parent.systemId) : undefined
  }
  return path
}

export interface SearchEntry {
  systemId: string
  systemTitle: string
  nodeId: string
  label: string
  kind: 'node' | 'subgraph'
}

export function buildSearchIndex(universe: Universe): SearchEntry[] {
  const entries: SearchEntry[] = []
  for (const system of universe.systems.values()) {
    for (const node of system.diagram.nodes) {
      entries.push({
        systemId: system.def.id,
        systemTitle: system.def.title,
        nodeId: node.id,
        label: node.label,
        kind: 'node',
      })
    }
    for (const subgraph of system.diagram.subgraphs) {
      entries.push({
        systemId: system.def.id,
        systemTitle: system.def.title,
        nodeId: subgraph.id,
        label: subgraph.label,
        kind: 'subgraph',
      })
    }
  }
  return entries
}
