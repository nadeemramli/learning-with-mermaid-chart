import { Navigate, Route, Routes } from 'react-router-dom'
import ExplorerPage from './components/ExplorerPage'
import UnknownSystem from './components/UnknownSystem'
import { universe } from './lib/loadUniverse'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/s/${universe.rootId}`} replace />} />
      <Route path="/s/:systemId" element={<ExplorerPage />} />
      <Route path="*" element={<UnknownSystem />} />
    </Routes>
  )
}
