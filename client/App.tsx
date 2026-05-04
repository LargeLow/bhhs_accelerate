import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import LoginPage from './pages/LoginPage';
import LibraryPage from './pages/LibraryPage';
import CampaignPage from './pages/CampaignPage';
import AdminPage from './pages/AdminPage';

async function fetchMe() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) return null;
  return res.json() as Promise<{ id: string; email: string; role: 'admin' | 'agent'; name: string }>;
}

export default function App() {
  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bhhs-maroon">
        <div className="text-white text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LibraryPage user={user} />} />
        <Route path="/campaign/:id" element={<CampaignPage user={user} />} />
        {user.role === 'admin' && <Route path="/admin" element={<AdminPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
