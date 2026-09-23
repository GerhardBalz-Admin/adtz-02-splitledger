import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { AppHeader } from './components/AppHeader';
import { AuthPage } from './pages/AuthPage';
import { CreateGroupPage } from './pages/CreateGroupPage';
import { ExpenseFormPage } from './pages/ExpenseFormPage';
import { GroupPage } from './pages/GroupPage';
import { GroupsPage } from './pages/GroupsPage';
import { JoinGroupPage } from './pages/JoinGroupPage';

function RequireAuth() {
  const { user, loading, signedOut } = useAuth();
  const location = useLocation();
  if (loading) return <p className="loading">Loading…</p>;
  if (!user) return <Navigate to="/signin" replace state={signedOut ? null : { from: location.pathname }} />;
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/signin" element={<AuthPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<GroupsPage />} />
          <Route path="/groups/new" element={<CreateGroupPage />} />
          <Route path="/join" element={<JoinGroupPage />} />
          <Route path="/groups/:groupId" element={<GroupPage />} />
          <Route path="/groups/:groupId/expenses/new" element={<ExpenseFormPage />} />
          <Route path="/groups/:groupId/expenses/:expenseId/edit" element={<ExpenseFormPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
