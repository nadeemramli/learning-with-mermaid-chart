import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { universe } from '../lib/loadUniverse'
import type { LoadedSystem } from '../lib/universe'
import { DrillContext } from './drillContext'
import HeaderBar from './HeaderBar'
import NodeDetailPanel from './NodeDetailPanel'
import ParentContextPanel from './ParentContextPanel'
import SearchPalette from './SearchPalette'
import SystemCanvas from './SystemCanvas'
import UnknownSystem from './UnknownSystem'

export default function ExplorerPage() {
  const { systemId } = useParams()
  const system = systemId ? universe.systems.get(systemId) : undefined
  if (!system) return <UnknownSystem />
  return <Explorer key={system.def.id} system={system} />
}

function Explorer({ system }: { system: LoadedSystem }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const state = (location.state ?? {}) as { entry?: 'in' | 'out'; focusNode?: string }
  const entry = state.entry ?? null
  const focusNode = searchParams.get('node') ?? state.focusNode ?? null

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  const drillRef = useRef<((nodeId: string) => void) | null>(null)
  const registerDrill = useCallback((fn: (nodeId: string) => void) => {
    drillRef.current = fn
  }, [])
  const drill = useCallback((nodeId: string) => drillRef.current?.(nodeId), [])

  const zoomOut = useCallback(() => {
    if (!system.parent) return
    navigate(`/s/${system.parent.systemId}`, {
      state: { entry: 'out', focusNode: system.parent.nodeId },
    })
  }, [system, navigate])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const inInput = (event.target as HTMLElement)?.tagName === 'INPUT'
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((open) => !open)
      } else if (event.key === '/' && !searchOpen && !inInput) {
        event.preventDefault()
        setSearchOpen(true)
      } else if (event.key === 'Escape' && !searchOpen) {
        if (selectedId) setSelectedId(null)
        else zoomOut()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen, selectedId, zoomOut])

  return (
    <DrillContext.Provider value={drill}>
      <div className="flex h-full flex-col">
        <HeaderBar system={system} onSearch={() => setSearchOpen(true)} />
        <div className="relative flex-1 overflow-hidden">
          <SystemCanvas
            system={system}
            entry={entry}
            focusNode={focusNode}
            onSelectNode={setSelectedId}
            registerDrill={registerDrill}
          />
          <ParentContextPanel system={system} onZoomOut={zoomOut} />
          {selectedId && (
            <NodeDetailPanel system={system} nodeId={selectedId} onClose={() => setSelectedId(null)} />
          )}
        </div>
      </div>
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
    </DrillContext.Provider>
  )
}
