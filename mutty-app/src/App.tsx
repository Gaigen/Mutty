import { Routes, Route } from 'react-router-dom'
import { FloatingWindowManagerProvider } from '@mutty/shared';
import HomePage from './pages/HomePage'
import RoomPage from './pages/RoomPage'
import PreviewTestPage from './pages/PreviewTestPage'

export default function App() {
  return (
    <FloatingWindowManagerProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomName" element={<RoomPage />} />
        <Route path="/preview-test" element={<PreviewTestPage />} />
      </Routes>
    </FloatingWindowManagerProvider>
  )
}
