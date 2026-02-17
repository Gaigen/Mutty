import { Routes, Route } from 'react-router-dom';
import HomePage from '@/pages/HomePage';
import RoomPage from '@/pages/RoomPage';

function App() {
  return (
    <div className="min-h-screen w-full">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomName" element={<RoomPage />} />
      </Routes>
    </div>
  )
}

export default App

