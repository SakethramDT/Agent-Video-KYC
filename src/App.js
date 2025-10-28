// /mnt/data/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useNavigate, Navigate } from 'react-router-dom';
import AgentLogin from './components/AgentLogin';
import ProtectedRouteAdmin from './components/ProtectedRouteAdmin';
import OfficerDashboard from './components/OfficerDashboard';
import SessionsPage from './components/SessionsPage';
import MyReviews from './components/MyReviews';
import SecureIDVSidebar from './components/Sidebar';
import StatsGrid from './components/StatsGrid';
import DocumentManagement from './components/Documents';
import TabContainer from './components/TabContainer';
import Header from './components/Header';
import axios from 'axios';
import './styles.css';

/**
 * App wrapper with Router
 */
export default function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}

function App() {
  const navigate = useNavigate();
  const [loggedInAgent, setLoggedInAgent] = useState(localStorage.getItem('kycAgent') || '');

  useEffect(() => {
    if (loggedInAgent) localStorage.setItem('kycAgent', loggedInAgent);
    else localStorage.removeItem('kycAgent');
  }, [loggedInAgent]);

  const handleLogout = async ({ callApi = false, redirect = true } = {}) => {
    if (callApi) {
      try {
        await axios.post(`${process.env.REACT_APP_BACKEND_URL || ''}/agent/logout`, {}, { withCredentials: true });
      } catch (err) {
        console.warn('Logout API failed:', err?.message || err);
      }
    }
    setLoggedInAgent('');
    localStorage.removeItem('kycAgent');
    if (redirect) navigate('/login', { replace: true });
  };

  const getStatusBadgeStyle = (status) => {
    const base = { padding: '4px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 500, display: 'inline-block' };
    switch ((status || '').toLowerCase()) {
      case 'pending': return { ...base, backgroundColor: '#fef3c7', color: '#92400e' };
      case 'in-progress': return { ...base, backgroundColor: '#dbeafe', color: '#1e40af' };
      case 'completed': return { ...base, backgroundColor: '#d1fae5', color: '#065f46' };
      case 'rejected': return { ...base, backgroundColor: '#fee2e2', color: '#991b1b' };
      default: return { ...base, backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  const getRiskBadgeStyle = (risk) => {
    const base = { padding: '4px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 500, display: 'inline-block' };
    switch ((risk || '').toLowerCase()) {
      case 'low': return { ...base, backgroundColor: '#d1fae5', color: '#065f46' };
      case 'medium': return { ...base, backgroundColor: '#fef3c7', color: '#92400e' };
      case 'high': return { ...base, backgroundColor: '#fee2e2', color: '#991b1b' };
      default: return { ...base, backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  const getAgentStatusDotStyle = (status) => {
    const base = { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' };
    switch ((status || '').toLowerCase()) {
      case 'online': return { ...base, backgroundColor: '#10b981' };
      case 'busy': return { ...base, backgroundColor: '#f59e0b' };
      case 'offline': return { ...base, backgroundColor: '#6b7280' };
      default: return { ...base, backgroundColor: '#6b7280' };
    }
  };

  if (!loggedInAgent) {
    return <AgentLogin setLoggedInAgent={setLoggedInAgent} />;
  }

  const normalized = (loggedInAgent || '').toLowerCase().replace(/\s/g, '');
  const isAdmin = normalized === 'admin';

  // -------- Layout components --------
  const AdminLayout = ({ children }) => {
    return (
      <div className="admin-root" style={{ display: 'flex', minHeight: '100vh' }}>
        <SecureIDVSidebar
          style={{ width: 290 }}
          loggedInAgent={loggedInAgent}
          onLogout={() => handleLogout({ callApi: false, redirect: true })}
        />
        {/* Main content area has its own container for route-specific styling */}
        <div className="admin-main" style={{ flex: 1, marginLeft: 290, minHeight: '100vh'}}>
          {children}
        </div>
      </div>
    );
  };

  // AgentLayout now guards against unauthenticated users and provides agent header
  const AgentLayout = ({ children }) => {
    if (!loggedInAgent) return <Navigate to="/login" replace />;

    return (
      <div className="agent-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',marginTop:70 }}>
        <header className="agent-header" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
          <div>
            <h2 style={{ margin: 0 }}>KYC Applications Dashboard</h2>
            <div style={{ fontSize: 13, color: '#666' }}>Agent: {loggedInAgent}</div>
          </div>
          <div>
            <button style={{backgroundColor:'cream', height:30,borderRadius:6}} onClick={() => handleLogout({ callApi: false, redirect: true })}>Logout</button>
          </div>
        </header>

        <main className="agent-main" style={{ padding: 20 }}>
          {children}
        </main>
      </div>
    );
  };

  // ProtectedRouteAdmin is already provided; we'll still nest under the admin layout

  return (
    <Routes>
      {/* Admin routes (only accessible if loggedInAgent is admin) */}
      <Route path="/" element={
        isAdmin ? (
          <AdminLayout>
            <ProtectedRouteAdmin loggedInAgent={loggedInAgent}>
              <OfficerDashboard
                apiBase={`${process.env.REACT_APP_BACKEND_URL || ''}/api`}
                loggedInAgent={loggedInAgent}
                onLogout={() => handleLogout({ callApi: false, redirect: true })}
              />
            </ProtectedRouteAdmin>
          </AdminLayout>
        ) : <Navigate to="/app" replace />
      } />

      <Route path="/admin" element={
        isAdmin ? (
          <AdminLayout>
            <ProtectedRouteAdmin loggedInAgent={loggedInAgent}>
              <OfficerDashboard
                apiBase={`${process.env.REACT_APP_BACKEND_URL || ''}/api`}
                loggedInAgent={loggedInAgent}
                onLogout={() => handleLogout({ callApi: false, redirect: true })}
              />
            </ProtectedRouteAdmin>
          </AdminLayout>
        ) : <Navigate to="/app" replace />
      } />

      <Route path="/sessions" element={
        isAdmin ? (
          <AdminLayout>
            <ProtectedRouteAdmin loggedInAgent={loggedInAgent}>
              <SessionsPage
                loggedInAgent={loggedInAgent}
                getStatusBadgeStyle={getStatusBadgeStyle}
                getRiskBadgeStyle={getRiskBadgeStyle}
                getAgentStatusDotStyle={getAgentStatusDotStyle}
                adminMode
              />
            </ProtectedRouteAdmin>
          </AdminLayout>
        ) : <Navigate to="/app" replace />
      } />

      <Route path="/myreviews" element={
        isAdmin ? (
          <AdminLayout>
            <ProtectedRouteAdmin loggedInAgent={loggedInAgent}>
              <MyReviews
                loggedInAgent={loggedInAgent}
                getStatusBadgeStyle={getStatusBadgeStyle}
                getRiskBadgeStyle={getRiskBadgeStyle}
              />
            </ProtectedRouteAdmin>
          </AdminLayout>
        ) : <Navigate to="/app" replace />
      } />
      <Route path="/documents" element={
        isAdmin ? (
          <AdminLayout>
            <ProtectedRouteAdmin loggedInAgent={loggedInAgent}>
              <DocumentManagement
                loggedInAgent={loggedInAgent}
                getStatusBadgeStyle={getStatusBadgeStyle}
                getRiskBadgeStyle={getRiskBadgeStyle}
              />
            </ProtectedRouteAdmin>
          </AdminLayout>
        ) : <Navigate to="/app" replace />
      } />
       

      {/* Agent routes */}
      <Route path="/app" element={
        <AgentLayout>
          <div>
            <Header/>
            <StatsGrid agent={loggedInAgent} />
            <TabContainer
              loggedInAgent={loggedInAgent}
              getStatusBadgeStyle={getStatusBadgeStyle}
              getRiskBadgeStyle={getRiskBadgeStyle}
              getAgentStatusDotStyle={getAgentStatusDotStyle}
            />
          </div>
        </AgentLayout>
      } />

      <Route path="/login" element={<AgentLogin setLoggedInAgent={setLoggedInAgent} />} />
      <Route path="/not-authorized" element={<div>Not authorized</div>} />
      {/* fallback */}
      <Route path="*" element={<Navigate to={isAdmin ? "/admin" : "/app"} replace />} />
    </Routes>
  );
}
