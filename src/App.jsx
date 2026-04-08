import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./login";
import KanbanBoard from "./taskboard";
import AuthenticatedRoute from "./components/AuthenticatedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <AuthenticatedRoute>
              <KanbanBoard />
            </AuthenticatedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}