import { useLocation } from "react-router-dom";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ConnectionPage from "./pages/ConnectionPage";
import ProfilePage from "./pages/ProfilePage";
import SearchPage from "./pages/SearchPage";
import HistoryPage from "./pages/HistoryPage";
import GraphPage from "./pages/GraphPage";

export default function App() {
  const location = useLocation();
  const isOnInvestigate = location.pathname === "/";

  return (
    <Routes>
      <Route
        element={
          <Layout>
            {/* ConnectionPage is ALWAYS rendered but hidden when not active.
                This preserves search state (SSE streams, logs, graph) when
                navigating to History/Search and back. */}
            <div style={{ display: isOnInvestigate ? "block" : "none" }}>
              <ConnectionPage />
            </div>
          </Layout>
        }
      >
        {/* Empty element for "/" — ConnectionPage is rendered above */}
        <Route path="/" element={null} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/profile/:id" element={<ProfilePage />} />
      </Route>
    </Routes>
  );
}
