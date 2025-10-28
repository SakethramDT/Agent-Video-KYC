import React, { useState, useEffect } from 'react';
import { Phone, Calendar, Search, Users, Eye,Download } from 'lucide-react';
import '../styles.css';
import ViewSessionModal from './ViewSessionModal';

const MyReviews = ({
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
  const [claimedSessions, setClaimedSessions] = useState([]);

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
          status: user.status,
          risk: 'low',
          date: user.date_of_birth || 'N/A',
          phone: user.phone || 'N/A',
          documents: user.document_url ? 1 : 0,
          assignedTo: user.assigned_to || null,
        }));
        const nonPendingInProgress = mapped.filter(
          (session) =>
            session.status.toLowerCase() !== 'pending' &&
            session.status.toLowerCase() !== 'in-progress' &&
            session.status.toLowerCase() !== 'document_uploaded'  &&
            session.status.toLowerCase() !== 'a'
        );
        const filtered =
          loggedInAgent.toLowerCase().replace(/\s/g, '') === 'admin'
            ? nonPendingInProgress
            : nonPendingInProgress.filter(
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
  const handleClaimSession = async (session) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/users/${session.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'review' }),
      });

      if (response.ok) {
        // Backend update succeeded
        setClaimedSessions(prev => [...prev, session.id]);
        handleViewSession({ ...session, status: 'review',assignedTo:loggedInAgent });  // Optionally pass updated session
      } else {
        console.error('Failed to update status:', response.statusText);
        alert('Failed to claim session. Try again.');
      }
    } catch (error) {
      console.error('Error updating session status:', error);
      alert('Something went wrong. Please try again.');
    }
  };
  async function downloadKycPdf(userId) {
  const resp = await fetch(`http://164.52.217.141:5000/api/kyc/pdf?userId=${userId}`);
  if (!resp.ok) throw new Error("PDF generation failed");
  const blob = await resp.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "uae_kyc_report.pdf";
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
  const handleViewSession = (session) => {
    setViewingSession(session);
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
            <option>review</option>
            <option>completed</option>
            <option>rejected</option>
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

                  {(session.status === 'claim-to-review' || session.status === 'review') && (
                    <button
                      onClick={() => handleClaimSession(session)}
                      className="kyc-action-button kyc-view-button"
                    >
                      <span>
                        {claimedSessions.includes(session.id) || session.status === 'review'
                          ? 'Continue Review'
                          : 'Claim & Review'}
                      </span>
                    </button>
                  )}


                  {(session.status === 'completed' || session.status === 'rejected') && (
                    <>
                      <button
                        onClick={() => handleViewSession(session)}  // Fixed: Added onClick handler
                        className="kyc-action-button kyc-view-button"
                      >
                        <Eye size={16} />
                        <span>View</span>
                      </button>
                    </>
                  )}

                </div>
                <div>
                  {(session.status === 'completed' || session.status === 'rejected') && (
                    <>
                    <button className="kyc-action-button kyc-view-button" onClick={() => downloadKycPdf(session.id)}><Download size={16} /> </button>
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

export default MyReviews;