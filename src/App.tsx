import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./ui/app/ErrorBoundary.js";
import { AppShell } from "./ui/app/AppShell.js";
import { ProjectDashboard } from "./ui/dashboard/ProjectDashboard.js";
import { ProjectWorkspace } from "./ui/workspace/ProjectWorkspace.js";
import { ProjectHistory } from "./ui/history/ProjectHistory.js";
import { ToastProvider } from "./ui/primitives/Toast.js";
export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<ProjectDashboard />} />
              <Route
                path="/projects/:projectId"
                element={<ProjectWorkspace />}
              />
              <Route
                path="/projects/:projectId/history"
                element={<ProjectHistory />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
