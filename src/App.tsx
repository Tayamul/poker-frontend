
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import HomePage from "./pages/HomePage";
import ComputerGamePage from "./pages/ComputerGamePage";
import LobbyPage from "./pages/LobbyPage";
import OnlineGamePage from "./pages/OnlineGamePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/computer" element={<ComputerGamePage />} />
        <Route path="/room/:code" element={<LobbyPage />} />
        <Route path="/online/:code" element={<OnlineGamePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
