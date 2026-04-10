import { Routes, Route } from 'react-router-dom';
import HomePage from '@shared/pages/HomePage';
import RoomPage from '@shared/pages/RoomPage';

function App() {
  return (
    <div className="min-h-screen w-full">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomName" element={<RoomPage />} />
      </Routes>
    </div>
  );
}

export default App;
