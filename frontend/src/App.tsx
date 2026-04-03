import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { NotifierProvider } from './context/NotifierContext';
import Login from './components/Login';
import DashboardLayout from './components/DashboardLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function LoginRoute() {
  const { token, login } = useAuth();
  const navigate = useNavigate();

  if (token) {
    return <Navigate to="/" replace />;
  }

  return (
    <Login
      onLogin={(newToken) => {
        login(newToken);
        navigate('/', { replace: true });
      }}
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <NotifierProvider enabled>
              <ErrorBoundary>
                <DashboardLayout />
              </ErrorBoundary>
            </NotifierProvider>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
