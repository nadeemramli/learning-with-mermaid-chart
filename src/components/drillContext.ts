import { createContext, useContext } from 'react'

/** Drill into the child system linked from the given node id (no-op if none). */
export const DrillContext = createContext<(nodeId: string) => void>(() => {})

export const useDrill = () => useContext(DrillContext)
