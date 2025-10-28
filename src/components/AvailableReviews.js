import React, { useState, useEffect } from 'react';
import { Phone, Calendar, Search, Users } from 'lucide-react';
import '../styles.css';
import ViewSessionModal from './ViewSessionModal';

const AvailableReviews = ({
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
  const [viewingSession, setViewingSession] = useState(null);

  // Fetch sessions from backend
  useEffect(() => {
    let intervalId;

    async function fetchSessions() {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/agent/users/`);
        const data = await response.json();

        const mapped = data.map((user) => ({
          id: user.user_id,
          name: user.name,
          status: user.status || 'pending',
          risk: 'low',
          date: user.date_of_birth || 'N/A',
          phone: user.phone || 'N/A',
          documents: user.document_url ? 1 : 0,
          is_claim: user.is_claim,
        }));
        const claimToReviewFalseClaims = mapped.filter(
          (session) =>
            session.status?.toLowerCase() === 'claim-to-review' &&
            session.is_claim === true
        );

        const filtered =
          loggedInAgent.toLowerCase().replace(/\s/g, '') === 'admin'
            ? claimToReviewFalseClaims
            : claimToReviewFalseClaims.filter(
              (session) =>
                session.assignedTo?.toLowerCase().replace(/\s/g, '') ===
                loggedInAgent.toLowerCase().replace(/\s/g, '')
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
  }, [loggedInAgent]);

  // Assign session to an available agent and mark session as in-progress
  const handleClaimChange = async (sessionId) => {
    try {
      // Update session status and assign agent
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/users/${sessionId}/claim-status-assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'review',
          assigned_to: loggedInAgent,
          is_claim: false
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
              status: 'review',
              assignedTo: loggedInAgent,
            }
            : session
        )
      );
    }
    catch (err) {
      console.error('Error starting review:', err);
      alert('Failed to start review. Please try again.');
    }
  };

  if (loading) return <div className="kyc-loading">Loading sessions...</div>;

  const filteredSessions = sessions.filter((s) => {
    const search = searchTerm.toLowerCase().trim();
    const matchesName = s.name?.toLowerCase().includes(search);
    const matchesId = s.id.toString().includes(search);
    const matchesStatus =
      selectedStatus === 'All Statuses' ||
      selectedStatus.toLowerCase() === s.status.toLowerCase();

    return (matchesName || matchesId) && matchesStatus;
  });

  return (
    <div className="kyc-container">

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
                      <span className="kyc-session-detail-item">
                        <Phone size={16} />
                        <span>{session.phone}</span>
                      </span>
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
                  {(session.status === 'claim-to-review') && (
                    <button
                      onClick={() => handleClaimChange(session.id)}
                      className="kyc-action-button kyc-start-review-button"
                    >
                      Claim & Review
                    </button>
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

export default AvailableReviews;