import React, { useState,useEffect } from 'react';
import { Video, Calendar, FileText, BarChart3, Bell, Shield } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
const SecureIDVSidebar = ({ loggedInAgent = '', onLogout = () => {} }) => {
  const [activeNav, setActiveNav] = useState('dashboard');
  const navigate = useNavigate();
  const location = useLocation();  

  useEffect(() => {
    if (location.pathname.includes('/sessions')) {
      setActiveNav('sessions');
    } else if (location.pathname.includes('/documents')) {
      setActiveNav('documents');
    } else if (location.pathname.includes('/reports')) {
      setActiveNav('reports');
    } else {
      setActiveNav('dashboard');
    }
  }, [location.pathname]);
  const styles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }

    .sidebar-container {
      width: 290px;
      height: 100vh;
      background-color: #ffffff;
      border-right: 1px solid #e5e7eb;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      position:fixed;
      
    }

    .logo-section {
      padding: 24px;
      border-bottom: 1px solid #e5e7eb;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);
    }

    .logo-shield {
      width: 28px;
      height: 28px;
      color: #ffffff;
    }

    .logo-status {
      width: 12px;
      height: 12px;
      background-color: #10b981;
      border-radius: 50%;
      position: absolute;
      top: -3px;
      right: -3px;
      border: 2px solid #ffffff;
    }

    .logo-text h1 {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 2px;
    }

    .logo-text p {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.4;
    }

    .navigation-section {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .nav-title {
      font-size: 11px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      padding: 0 12px;
    }

    .nav-menu {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-radius: 10px;
      border: none;
      background: transparent;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 15px;
      font-weight: 500;
      color: #374151;
      width: 100%;
      text-align: left;
    }

    .nav-item:hover { background-color: #f9fafb; }
    .nav-item.active { background-color: #eff6ff; color: #2563eb; }

    .nav-item-content { display: flex; align-items: center; gap: 12px; }
    .nav-icon { width: 20px; height: 20px; }

    .nav-badge {
      padding: 4px 10px;
      background-color: #dbeafe;
      color: #2563eb;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
    }

    .profile-section {
      padding: 16px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
    }

    .profile-container {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      position: relative;
    }

    .profile-avatar {
      width: 44px;
      height: 44px;
      background-color: #e5e7eb;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      flex-shrink: 0;
    }

    .profile-avatar span {
      font-size: 14px;
      font-weight: 600;
      color: #4b5563;
    }

    .profile-status {
      width: 12px;
      height: 12px;
      background-color: #10b981;
      border-radius: 50%;
      position: absolute;
      top: -2px;
      right: -2px;
      border: 2px solid #ffffff;
    }

    .profile-info {
      flex: 1;
    }

    .profile-name {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 2px;
      position: relative;
    }

    .profile-status-text {
      font-size: 12px;
      color: #10b981;
    }

    .profile-id { color: #6b7280; }

    /* --- New Hover Logout Animation --- */
    .logout-button {
      background: transparent;
      border: none;
      color: #ef4444;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.25s ease, transform 0.25s ease;
      padding: 6px 10px;
      border-radius: 8px;
    }

    .profile-section:hover .logout-button,
    .profile-section:focus-within .logout-button {
      opacity: 1;
      transform: translateY(0);
    }

    .logout-button:hover {
      background-color: #fee2e2;
    }

    /* --- Updated Bell Icon --- */
    .notification-btn {
      padding: 8px;
      background: transparent;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      position: relative;
    }

    .notification-btn:hover {
      background-color: #f3f4f6;
      box-shadow: 0 0 8px rgba(37, 99, 235, 0.15);
    }

    /* small notification indicator dot */
    .notification-btn::after {
      content: '';
      position: absolute;
      top: 6px;
      right: 6px;
      width: 8px;
      height: 8px;
      background-color: #ef4444;
      border-radius: 50%;
      border: 1.5px solid #ffffff;
    }

    .notification-icon {
      width: 20px;
      height: 20px;
      color: #9ca3af;
    }

    @media (max-width: 900px) {
      .sidebar-container { width: 100%; height: auto; border-right: none; }
    }
  `;

  const displayName = loggedInAgent || localStorage.getItem('kycAgent') || 'IDV Officer';

  return (
    <>
      <style>{styles}</style>
      <div className="sidebar-container">
        {/* Logo Section */}
        <div className="logo-section">
          <div className="logo-container">
            <div className="logo-icon">
              <Shield className="logo-shield" />
              <div className="logo-status"></div>
            </div>
            <div className="logo-text">
              <h1>SecureIDV</h1>
              <p>Identity Verification<br />Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
       <div className="navigation-section">
          <div className="nav-title">Main Navigation</div>
          <div className="nav-menu">
            
            <button
              className={`nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
              onClick={() => {
                setActiveNav('dashboard');
                navigate('/admin'); // optional route for Officer Dashboard
              }}
            >
              <div className="nav-item-content">
                <BarChart3 className="nav-icon" />
                <span>Officer Dashboard</span>
              </div>
            </button>

            <button
              className={`nav-item ${activeNav === 'sessions' ? 'active' : ''}`}
              onClick={() => {
                setActiveNav('sessions');
                navigate('/sessions'); // ✅ this sends user to SessionsList page
              }}
            >
              <div className="nav-item-content">
                <Video className="nav-icon" />
                <span>Sessions</span>
              </div>
               
            </button>

            {/* <button
              className={`nav-item ${activeNav === 'schedule' ? 'active' : ''}`}
              onClick={() => {
                setActiveNav('schedule');
                navigate('/schedule'); // optional if you have a schedule route
              }}
            >
              <div className="nav-item-content">
                <Calendar className="nav-icon" />
                <span>Schedule IDV</span>
              </div>
            </button> */}


            <button className={`nav-item ${activeNav === 'documents' ? 'active' : ''}`} 
               onClick={() => {
                setActiveNav('documents');
                navigate('/documents'); // ✅ this sends user to SessionsList page
              }}>
              <div className="nav-item-content"><FileText className="nav-icon" /><span>Documents</span></div>
            </button>

            <button className={`nav-item ${activeNav === 'reports' ? 'active' : ''}`} onClick={() => setActiveNav('reports')}>
              <div className="nav-item-content"><BarChart3 className="nav-icon" /><span>Reports</span></div>
            </button>
          </div>
        </div>

        {/* Profile Section */}
        <div className="profile-section">
          <div className="profile-container" tabIndex={0}>
            <div className="profile-avatar">
              <span>{(displayName || 'IO').slice(0,2).toUpperCase()}</span>
              <div className="profile-status"></div>
            </div>
            <div className="profile-info">
              <div className="profile-name">{displayName}</div>
              <div className="profile-status-text">
                Online <span className="profile-id">• Officer ID</span>
              </div>
            </div>

            {/* Logout + Bell */}
            <button
              className="logout-button"
              onClick={() => {
                if (typeof onLogout === 'function') onLogout();
                else {
                  localStorage.removeItem('kycAgent');
                  window.location.reload();
                }
              }}
            >
              Logout
            </button>

            <button className="notification-btn" title="Notifications">
              <Bell className="notification-icon" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SecureIDVSidebar;
