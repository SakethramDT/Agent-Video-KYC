import React, { useState, useEffect } from 'react';
import { Phone, Calendar, Search, Users, Eye } from 'lucide-react';
import '../styles.css';
import VideoCallModal from './VideoCallModal';
import ViewSessionModal from './ViewSessionModal';

const SessionsList = ({
  searchTerm,
  setSearchTerm,
  selectedStatus,
  setSelectedStatus,
  getStatusBadgeStyle,
  getRiskBadgeStyle,
  loggedInAgent,
}) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCall, setActiveCall] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [viewingSession, setViewingSession] = useState(null);
  const NGROK_HEADERS = { "ngrok-skip-browser-warning": "true" };

  // SAFE agent string: prefer prop, fallback to localStorage, fallback to empty string
  const agent = (loggedInAgent || localStorage.getItem('kycAgent') || '');

  // Fetch sessions from backend
  useEffect(() => {
    let intervalId;

    async function fetchSessions() {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/agent/users/`);
        const data = await response.json();
        console.log("user_data", data);
        const mapped = data.map((user) => ({
          id: user.user_id,
          name: user.name,
          status: user.status || 'pending',
          risk: 'low',
          date: user.date_of_birth || 'N/A',
          phone: user.phone || 'N/A',
          documents: user.document_url ? 1 : 0,
          assignedTo: user.assigned_to || null,
        }));

        // ensure session.status is a string before calling toLowerCase
        const pendingAndInProgress = mapped.filter((session) => {
          const status = (session.status || '').toLowerCase();
          return status === 'pending' || status === 'in-progress';
        });

        // normalized agent for comparison
        const normalizedAgent = (agent || '').toLowerCase().replace(/\s/g, '');

        const filtered =
          normalizedAgent === 'admin'
            ? pendingAndInProgress
            : pendingAndInProgress.filter((session) =>
                (session.assignedTo || '').toLowerCase().replace(/\s/g, '') === normalizedAgent
              );

        setSessions(filtered);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
        setLoading(false);
      }
    }

    fetchSessions(); // initial fetch
    intervalId = setInterval(fetchSessions, 5000); // refresh every 5 seconds

    return () => clearInterval(intervalId); // cleanup
  }, [agent]); // depend on agent (safe string)

  // Assign session to an available agent and mark session as in-progress
  const handleStartReview = async (sessionId) => {
    try {
      // Update session status and assign agent
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/users/${sessionId}/claim-status-assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'in-progress',
          assigned_to: agent,
          is_claim: true
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update status: ${errorText}`);
      }

      // Update frontend state with assigned agent and new status
      setSessions((prevSessions) =>
        prevSessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                status: 'in-progress',
                assignedTo: agent
              }
            : session
        )
      );
    } catch (err) {
      console.error('Error starting review:', err);
      alert('Failed to start review. Please try again.');
    }
  };

  // Handle video call initiation
  const handleJoinCall = async (sessionId) => {
    try {
      // Get session details
      const session = sessions.find(s => s.id === sessionId);

      // Fetch room ID from server (use agent, not loggedInAgent)
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/get-room-id?user_id=${sessionId}&agent_username=${encodeURIComponent(agent)}`
      );

      if (!response.ok) throw new Error('Failed to get room ID');

      const data = await response.json();
      setRoomId(data.room_id);
      setActiveCall({
        sessionId,
        name: session.name,
        date: session.date,
        phone: session.phone,
        documents: session.documents,
        userInitial: session.name ? session.name.charAt(0).toUpperCase() : ''
      });
    } catch (err) {
      console.error('Error joining call:', err);
      alert('Failed to start video call. Please check your camera/microphone permissions and try again.');
    }
  };

  const handleViewSession = (session) => {
    setViewingSession(session);
  };

  if (loading) return <div className="kyc-loading">Loading sessions...</div>;

  // make searchTerm and selectedStatus safe
  const safeSearch = (searchTerm || '').toLowerCase().trim();
  const safeSelectedStatus = selectedStatus || 'All Statuses';

  const filteredSessions = sessions.filter((s) => {
    const matchesName = (s.name || '').toLowerCase().includes(safeSearch);
    const matchesId = s.id?.toString().includes(safeSearch);
    const matchesStatus =
      safeSelectedStatus === 'All Statuses' ||
      safeSelectedStatus.toLowerCase() === (s.status || '').toLowerCase();

    return (matchesName || matchesId) && matchesStatus;
  });

  return (
    <div className="kyc-container">
      {activeCall && roomId && (
        <VideoCallModal
          roomId={roomId}
          agent={agent}      // pass the safe agent string
          session={activeCall}
          onClose={() => {
            setActiveCall(null);
            setRoomId(null);
          }}
        />
      )}

      {viewingSession && (
        <ViewSessionModal 
          session={viewingSession} 
          onClose={() => setViewingSession(null)}
          getStatusBadgeStyle={getStatusBadgeStyle}
          getRiskBadgeStyle={getRiskBadgeStyle}
        />
      )}

      <div className="kyc-search-filter">
        <div className="kyc-search-section">
          <div className="kyc-search-input-container">
            <Search className="kyc-search-icon" size={18} />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="kyc-search-input"
            />
          </div>
        </div>
        <div className="kyc-filter-section">
          <span className="kyc-filter-label">Filter by Status</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="kyc-filter-select"
          >
            <option>All Statuses</option>
            <option>pending</option>
            <option>in-progress</option>
          </select>
        </div>
      </div>

      <div className="kyc-sessions-list">
        {filteredSessions.length === 0 ? (
          <div className="kyc-empty-state">
            <div className="kyc-empty-icon">📋</div>
            <h3>No sessions found</h3>
            <p>Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div key={session.id} className="kyc-session-card">
              <div className="kyc-session-header">
                <div className="kyc-session-info">
                  <div>
                    <h3 className="kyc-session-name">
                      <span>{session.name}</span>
                      <span style={getStatusBadgeStyle(session.status)}>
                        {session.status}
                      </span>
                      <span style={getRiskBadgeStyle(session.risk)}>
                        {session.risk} risk
                      </span>
                    </h3>
                    <div className="kyc-session-details">
                      <span className="kyc-session-detail-item">
                        <Users size={16} />
                        <span>{session.id}</span>
                      </span>
                      <span className="kyc-session-detail-item">
                        <Calendar size={16} />
                        <span>{session.date}</span>
                      </span>
                      {/* <span className="kyc-session-detail-item">
                        <Phone size={16} />
                        <span>{session.phone}</span>
                      </span> */}
                    </div>
                    <div className="kyc-session-meta">
                      <span>📄 {session.documents} document(s) uploaded</span>
                      {session.assignedTo && (
                        <span className="kyc-session-assigned">Assigned to: {session.assignedTo}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="kyc-session-actions">
                  {(session.status === 'pending' )&& (
                    <button
                      onClick={() => handleStartReview(session.id)}
                      className="kyc-action-button kyc-start-review-button"
                    >
                      Start Review
                    </button>
                  )}

                  {session.status === 'in-progress' && (
                    <>
                      <button
                        onClick={() => handleJoinCall(session.id)}
                        className="kyc-action-button kyc-join-call-button"
                      >
                        <Phone size={16} />
                        <span>Join Call</span>
                      </button>
                    </>
                  )}
                  {session.status==='review' && (
                    <>
                    <button 
                      onClick={() => handleViewSession(session)}
                      className="kyc-action-button kyc-view-button"
                    >
                      <Eye size={16} />
                      <span>Review</span>
                    </button>
                    </>
                  )}
                  {(session.status==='completed' || session.status==='rejected' ) && (
                    <>
                    <button 
                      onClick={() => handleViewSession(session)}
                      className="kyc-action-button kyc-view-button"
                    >
                      <Eye size={16} />
                      <span>View</span>
                    </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SessionsList;
