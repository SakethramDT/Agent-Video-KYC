// IDVOfficerDashboard.jsx
import React, { useEffect, useState, useRef } from 'react';
import SecureIDVSidebar from './Sidebar'; // adjust path if needed
import { Calendar, Video, Clock, AlertTriangle, CheckCircle, XCircle, Eye, TrendingUp } from 'lucide-react';


const initialsFromName = (name) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const formatTimestamp = (iso) => {
  if (!iso) return '';
  try {
    const dt = new Date(iso);
    const fmt = new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata'
    });
    return fmt.format(dt);
  } catch (e) {
    return iso;
  }
};

const IDVOfficerDashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [stats, setStats] = useState({
    todaysSessions: 0,
    activeNow: 0,
    pendingReviewCount: 0,
    completedToday: 0
  });
  const [performance, setPerformance] = useState({
    successRate: '0%',
    avgDurationMinutes: 'N/A',
    rejectionRate: '0%',
    customerRating: 'N/A'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loggedInAgent = localStorage.getItem('kycAgent') || '';
  const mountedRef = useRef(false);
  const intervalRef = useRef(null);
  const POLL_MS = 15000;

  // Robust fetch that surfaces non-JSON responses
  const fetchDashboard = async (signal) => {
    setError(null);
    try {
      const base = 'http://164.52.217.141:5000/api/officer/dashboard';
      const url = loggedInAgent ? `${base}?agent_id=${encodeURIComponent(loggedInAgent)}` : base;
      const resp = await fetch(url, { method: 'GET', credentials: 'same-origin', signal });

      // Non-OK statuses: read text for diagnostics
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`API error: ${resp.status} ${text}`);
      }

      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const text = await resp.text();
        const short = text.length > 400 ? text.slice(0, 400) + '... (truncated)' : text;
        throw new Error(`Expected JSON but got ${ct || 'unknown'}: ${short}`);
      }

      const json = await resp.json();
      if (!json.ok || !json.data) throw new Error(json.error || 'Invalid API response');

      const { sessions: sess, pendingReviews: pending, recentActivity: recent, stats: st, performance: perf } = json.data;

      const normalizedSessions = (sess || []).map(s => ({
        id: s.id,
        user_id: s.user_id,
        name: s.name || s.user_name || 'Unknown',
        initials: s.initials || initialsFromName(s.name || s.user_name || ''),
        time: s.time ? formatTimestamp(s.time) : '',
        officer: s.officer || '',
        status: s.status || 'scheduled',
        duration_minutes: s.duration_minutes || null,
        room_id: s.room_id || null
      }));

      const normalizedPending = (pending || []).map(p => ({
        id: p.id,
        name: p.name || p.display_name || p.username || 'Unknown',
        initials: p.initials || initialsFromName(p.name || p.display_name || p.username),
        time: p.timeAgo || ''
      }));

      const normalizedRecent = (recent || []).map(a => ({
        name: a.name || a.subject_name || 'Unknown',
        status: a.status || '',
        time: a.time ? formatTimestamp(a.time) : '',
        type: a.type || 'clock'
      }));

      if (!mountedRef.current) return;

      setSessions(normalizedSessions);
      setPendingReviews(normalizedPending);
      setRecentActivity(normalizedRecent);
      setStats({
        todaysSessions: st?.todaysSessions ?? 0,
        activeNow: st?.activeNow ?? 0,
        pendingReviewCount: st?.pendingReviewCount ?? 0,
        completedToday: st?.completedToday ?? 0
      });
      setPerformance({
        successRate: perf?.successRate ?? '0%',
        avgDurationMinutes: perf?.avgDurationMinutes ?? 'N/A',
        rejectionRate: perf?.rejectionRate ?? '0%',
        customerRating: perf?.customerRating ?? 'N/A'
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Failed to load dashboard:', err);
      if (mountedRef.current) setError(err.message || String(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    setLoading(true);
    fetchDashboard(controller.signal);

    // continuous polling interval
    intervalRef.current = setInterval(() => {
      const ctrl = new AbortController();
      fetchDashboard(ctrl.signal);
      // not storing this inner controller — interval cleared on unmount
    }, POLL_MS);

    return () => {
      mountedRef.current = false;
      controller.abort();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInAgent]);

  const handleStartSession = (sessionName) => {
    alert(`Starting session for ${sessionName}`);
  };

  const handleReview = (reviewName) => {
    alert(`Opening review for ${reviewName}`);
  };

   
  const handleViewAllSessions = () => {
     
  };

  const handleLogout = () => {
    localStorage.removeItem('kycAgent');
    window.location.replace('/login');
  };

  /* =========================
     Original styles (kept exactly as you had them)
     ========================= */
  const styles = `
    .sidebar-wrapper {
      position: fixed;
      left: 0;
      top: 0;
      height: 100vh;
      width: 290px; /* must match SecureIDVSidebar width */
      z-index: 50;
      display: block;
      pointer-events: auto;
      background: transparent;
    }

    .dashboard-scroll-area {
        flex: 1;
        max-width: 1200px;
        height: auto;
        min-height: 100vh;
        overflow-y: visible;
        overflow-x: hidden;
        padding: 32px;
        box-sizing: border-box;
        background-color: #f9fafb;
      -webkit-overflow-scrolling: touch;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
    }

    .header-title h1 {
      font-size: 32px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 8px;
    }

    .header-title p {
      font-size: 16px;
      color: #6b7280;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .btn {
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      border: none;
    }

    .btn-secondary {
      background-color: #ffffff;
      color: #374151;
      border: 1px solid #d1d5db;
    }

    .btn-secondary:hover {
      background-color: #f9fafb;
    }

    .btn-primary {
      background-color: #2563eb;
      color: #ffffff;
    }

    .btn-primary:hover {
      background-color: #1d4ed8;
    }

    .btn-icon {
      width: 16px;
      height: 16px;
    }

    /* Compact Stats Grid */
    .stats-grid.compact {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }

    .stat-card.compact {
      background-color: #ffffff;
      border-radius: 10px;
      padding: 14px 16px;
      border: 1px solid #e5e7eb;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: box-shadow 0.2s ease;
      min-height: 110px;
      max-width:240px;
    }

    .stat-card.compact:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }

    .stat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .stat-card-title {
      font-size: 13px;
      font-weight: 600;
      color: #6b7280;
      line-height: 1;
    }

    .stat-icon-wrapper {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .stat-icon-wrapper.blue { background-color: #eff6ff; }
    .stat-icon-wrapper.green { background-color: #f0fdf4; }
    .stat-icon-wrapper.yellow { background-color: #fef9c3; }

    .stat-icon { width: 16px; height: 16px; }
    .stat-icon.blue  { color: #2563eb; }
    .stat-icon.green { color: #16a34a; }
    .stat-icon.yellow{ color: #ca8a04; }

    .stat-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      line-height: 1;
    }

    .stat-label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 10px;
      border-radius: 999px;
      background: #fafafaff;
      color: #0f172a;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid rgba(212, 175, 55, 0.06);
      white-space: nowrap;
    }

    .stat-label.sm {
      padding: 2px 8px;
      font-size: 11px;
    }

    .content-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }

    .card {
      background-color: #ffffff;
      border-radius: 12px;
      padding: 24px;
      border: 1px solid #e5e7eb;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 700;
      color: #111827;
    }

    .card-title-icon {
      width: 20px;
      height: 20px;
      color: #374151;
    }

    .badge {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }

    .badge-blue {
      background-color: #eff6ff;
      color: #2563eb;
    }

    .session-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .session-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background-color: #f9fafb;
      border-radius: 10px;
      transition: background-color 0.2s ease;
    }

    .session-item:hover {
      background-color: #f3f4f6;
    }

    .session-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .session-avatar.blue {
      background-color: #bfdbfe;
      color: #1e40af;
    }

    .session-info {
      flex: 1;
    }

    .session-name {
      font-size: 15px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 6px;
    }

    .session-meta {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: #6b7280;
    }

    .session-meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .session-meta-icon {
      width: 14px;
      height: 14px;
    }

    .session-status {
      padding: 6px 14px;
      background-color: #dbeafe;
      color: #1e40af;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
    }

    .session-button {
      padding: 10px 16px;
      background-color: #ffffff;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }

    .session-button:hover {
      background-color: #f9fafb;
    }

    .session-button-icon {
      width: 16px;
      height: 16px;
    }

    .sidebar-column {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .pending-review-item {
      padding: 16px;
      background-color: #fef3c7;
      border-radius: 10px;
    }

    .pending-review-content {
      display: flex;
      gap: 12px;
    }

    .pending-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: #fde68a;
      color: #92400e;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .pending-info {
      flex: 1;
    }

    .pending-name {
      font-size: 15px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 6px;
    }

    .pending-time {
      font-size: 13px;
      color: #6b7280;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .pending-time-icon {
      width: 12px;
      height: 12px;
    }

    .review-button {
      width: 100%;
      padding: 10px 16px;
      background-color: #ca8a04;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 12px;
      transition: background-color 0.2s ease;
    }

    .review-button:hover {
      background-color: #a16207;
    }

    .review-button-icon {
      width: 16px;
      height: 16px;
    }

    .activity-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .activity-item {
      display: flex;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f3f4f6;
    }

    .activity-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .activity-icon-wrapper {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .activity-icon {
      width: 16px;
      height: 16px;
    }

    .activity-icon.clock {
      color: #6b7280;
    }

    .activity-icon.rejected {
      color: #dc2626;
    }

    .activity-icon.completed {
      color: #16a34a;
    }

    .activity-icon.pending {
      color: #ca8a04;
    }

    .activity-details {
      flex: 1;
    }

    .activity-name {
      font-size: 14px;
      font-weight: 500;
      color: #111827;
      margin-bottom: 4px;
    }

    .activity-status {
      font-size: 12px;
      color: #6b7280;
    }

    .performance-card {
      background-color: #ffffff;
      border-radius: 12px;
      padding: 24px;
      border: 1px solid #e5e7eb;
    }

    .performance-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .performance-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 700;
      color: #111827;
    }

    .performance-badge {
      padding: 6px 12px;
      background-color: #f0fdf4;
      color: #16a34a;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
    }

    .performance-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
    }

    .performance-metric {
      text-align: center;
    }

    .performance-value {
      font-size: 32px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 8px;
    }

    .performance-label {
      font-size: 14px;
      color: #6b7280;
    }

    @media (max-width: 900px) {
      .dashboard-scroll-area {
        margin-left: 0;
        padding: 16px;
      }
      .sidebar-wrapper {
        position: relative;
        width: 100%;
        height: auto;
      }
    }
  `;

  // Render original UI (unchanged from your initial layout)
  return (
    <>
      <style>{styles}</style>

      {/* Fixed sidebar wrapper */}
      <div className="sidebar-wrapper" aria-hidden={false}>
         <SecureIDVSidebar loggedInAgent={loggedInAgent} onLogout={handleLogout} />
      </div>

      {/* Main scrollable dashboard area */}
      <div className="dashboard-scroll-area">
        {/* Header */}
        <div className="dashboard-header">
          <div className="header-title">
            <h1>IDV Officer Dashboard</h1>
            <p>Monitor and manage video IDV sessions</p>
          </div>
          <div className="header-actions">
            {/* <button className="btn btn-secondary" onClick={handleScheduleSession}>
              <Calendar className="btn-icon" />
              Schedule Session
            </button> */}
            <button className="btn btn-primary" onClick={handleViewAllSessions}>
              <Video className="btn-icon" />
              View All Sessions
            </button>
          </div>
        </div>

        {/* Loading / Error */}
        {loading ? (
          <div style={{ marginBottom: 20, color: '#374151' }}>Loading dashboard...</div>
        ) : error ? (
          <div style={{ marginBottom: 20, color: 'crimson' }}>Error loading dashboard: {error}</div>
        ) : null}

        {/* Stats Grid */}
        <div className="stats-grid compact" aria-live="polite">
          <div className="stat-card compact">
            <div className="stat-card-header">
              <span className="stat-card-title">Today's Sessions</span>
              <div className="stat-icon-wrapper blue">
                <Video className="stat-icon blue" />
              </div>
            </div>
            <div className="stat-main">
              <div className="stat-value">{stats.todaysSessions}</div>
              <div className="stat-label">Scheduled</div>
            </div>
          </div>

          <div className="stat-card compact">
            <div className="stat-card-header">
              <span className="stat-card-title">Active Now</span>
              <div className="stat-icon-wrapper green">
                <Clock className="stat-icon green" />
              </div>
            </div>
            <div className="stat-main">
              <div className="stat-value">{stats.activeNow}</div>
              <div className="stat-label">Live</div>
            </div>
          </div>

          <div className="stat-card compact">
            <div className="stat-card-header">
              <span className="stat-card-title">Pending Review</span>
              <div className="stat-icon-wrapper yellow">
                <AlertTriangle className="stat-icon yellow" />
              </div>
            </div>
            <div className="stat-main">
              <div className="stat-value">{stats.pendingReviewCount}</div>
              <div className="stat-label">Action Required</div>
            </div>
          </div>

          <div className="stat-card compact">
            <div className="stat-card-header">
              <span className="stat-card-title">Completed Today</span>
              <div className="stat-icon-wrapper green">
                <CheckCircle className="stat-icon green" />
              </div>
            </div>
            <div className="stat-main">
              <div className="stat-value">{stats.completedToday}</div>
              <div className="stat-label">Verified</div>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="content-grid">
          {/* Active & Upcoming Sessions */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Video className="card-title-icon" />
                Active & Upcoming Sessions
              </h3>
              <span className="badge badge-blue">{sessions.length} active</span>
            </div>
            <div className="session-list">
              {sessions.map((session) => (
                <div key={session.id} className="session-item">
                  <div className="session-avatar blue">{session.initials}</div>
                  <div className="session-info">
                    <div className="session-name">{session.name}</div>
                    <div className="session-meta">
                      <span className="session-meta-item">
                        <Clock className="session-meta-icon" />
                        {session.time}
                      </span>
                      <span className="session-meta-item">
                        <Eye className="session-meta-icon" />
                        {session.officer}
                      </span>
                    </div>
                  </div>
                  <span className="session-status">{session.status}</span>
                  {/* <button
                    className="session-button"
                    onClick={() => handleStartSession(session.name)}
                  >
                    <Video className="session-button-icon" />
                    Start Session
                  </button> */}
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar column */}
          <div className="sidebar-column">
            {pendingReviews.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <AlertTriangle className="card-title-icon" />
                    Pending Reviews
                  </h3>
                </div>
                {pendingReviews.map((review) => (
                  <div key={review.id} className="pending-review-item">
                    <div className="pending-review-content">
                      <div className="pending-avatar">{review.initials}</div>
                      <div className="pending-info">
                        <div className="pending-name">{review.name}</div>
                        <div className="pending-time">
                          <Clock className="pending-time-icon" />
                          {review.time}
                        </div>
                      </div>
                    </div>
                    <button
                      className="review-button"
                      onClick={() => handleReview(review.name)}
                    >
                      <Eye className="review-button-icon" />
                      Review
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <Clock className="card-title-icon" />
                  Recent Activity
                </h3>
              </div>
              <div className="activity-list">
                {recentActivity.length === 0 ? (
                  <div style={{ color: '#6b7280' }}>No recent activity.</div>
                ) : (
                  recentActivity.map((activity, index) => (
                    <div key={index} className="activity-item">
                      <div className="activity-icon-wrapper">
                        {activity.type === 'clock' && <Clock className="activity-icon clock" />}
                        {activity.type === 'rejected' && <XCircle className="activity-icon rejected" />}
                        {activity.type === 'completed' && <CheckCircle className="activity-icon completed" />}
                        {activity.type === 'pending' && <AlertTriangle className="activity-icon pending" />}
                      </div>
                      <div className="activity-details">
                        <div className="activity-name">{activity.name}</div>
                        <div className="activity-status">
                          {activity.status} • {activity.time}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Performance */}
        <div className="performance-card">
          <div className="performance-header">
            <h3 className="performance-title">
              <TrendingUp className="card-title-icon" />
              Weekly Performance
            </h3>
            <span className="performance-badge">+12% vs last week</span>
          </div>
          <div className="performance-grid">
            <div className="performance-metric">
              <div className="performance-value">{performance.successRate}</div>
              <div className="performance-label">Success Rate</div>
            </div>
            <div className="performance-metric">
              <div className="performance-value">{performance.avgDurationMinutes}</div>
              <div className="performance-label">Avg Duration</div>
            </div>
            <div className="performance-metric">
              <div className="performance-value">{performance.rejectionRate}</div>
              <div className="performance-label">Rejection Rate</div>
            </div>
            <div className="performance-metric">
              <div className="performance-value">{performance.customerRating}</div>
              <div className="performance-label">Customer Rating</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default IDVOfficerDashboard;
