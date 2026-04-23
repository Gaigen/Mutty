import { Routes, Route } from 'react-router-dom';
import { FloatingWindowManagerProvider } from '@mutty/shared';
import HomePage from '@shared/pages/HomePage';
import RoomPage from '@shared/pages/RoomPage';

function App() {
  return (
    <FloatingWindowManagerProvider>
      <div className="min-h-screen w-full">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:roomName" element={<RoomPage />} />
        </Routes>
      </div>
    </FloatingWindowManagerProvider>
  );
}

export default App;
