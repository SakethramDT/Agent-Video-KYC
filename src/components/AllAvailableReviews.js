import React, { useState } from 'react';

const AllApplicationReviews = ({
  applicants = [],
  onStartReview,
  onContinueReview,
  onViewDetails,
  currentUser,
}) => {
  // State for sample data (for demonstration purposes)
  const [sampleApplicants] = useState([
    {
      id: 'app-1234567890',
      name: 'Sindhu',
      country: 'USA',
      documentType: 'Passport',
      status: 'PENDING',
      documents: [{ verified: false }],
      liveness: 92,
      matching: 85,
      reviewedBy: null,
      createdDate: '2023-05-15',
      source: 'Web'
    },
    {
      id: 'app-0987654321',
      name: 'Sakethram',
      country: 'Canada',
      documentType: 'Driver License',
      status: 'INREVIEW',
      documents: [{ verified: true }],
      liveness: 78,
      matching: 92,
      reviewedBy: 'reviewer1',
      createdDate: '2023-05-16',
      source: 'Mobile'
    },
    {
      id: 'app-4567890123',
      name: 'Durga Reddy',
      country: 'UK',
      documentType: 'ID Card',
      status: 'APPROVED',
      documents: [{ verified: true }],
      liveness: 95,
      matching: 88,
      reviewedBy: 'reviewer2',
      createdDate: '2023-05-10',
      source: 'Web'
    },
    {
      id: 'app-7890123456',
      name: 'Lekha Reddy',
      country: 'Australia',
      documentType: 'Passport',
      status: 'REJECTED',
      documents: [{ verified: false }],
      liveness: 45,
      matching: 60,
      reviewedBy: 'reviewer1',
      createdDate: '2023-05-18',
      source: 'Partner'
    }
  ]);

  // Use sample data if applicants is undefined or empty
  const dataToRender = applicants && applicants.length > 0 ? applicants : sampleApplicants;

  const getStatusIcon = (status) => {
    switch (status) {
      case "PENDING":
        return <ClockIcon />;
      case "INREVIEW":
        return <LockIcon />;
      case "APPROVED":
        return <CheckCircleIcon />;
      case "REJECTED":
        return <XCircleIcon />;
      default:
        return <AlertCircleIcon />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING":
        return "status-pending";
      case "INREVIEW":
        return "status-inreview";
      case "APPROVED":
        return "status-approved";
      case "REJECTED":
        return "status-rejected";
      default:
        return "status-default";
    }
  };

  // Default handlers if not provided
  const handleStartReview = onStartReview || ((applicant) => {
    console.log('Start review:', applicant);
    alert(`Starting review for ${applicant.name}`);
  });

  const handleContinueReview = onContinueReview || ((applicant) => {
    console.log('Continue review:', applicant);
    alert(`Continuing review for ${applicant.name}`);
  });

  const handleViewDetails = onViewDetails || ((applicant) => {
    console.log('View details:', applicant);
    alert(`Viewing details for ${applicant.name}`);
  });

  const currentUserValue = currentUser || "reviewer1";

  return (
    <div className="applications-table-container">
      <div className="table-header">
        <h2>Application Review Dashboard</h2>
        <div className="table-info">
          Showing {dataToRender.length} application{dataToRender.length !== 1 ? 's' : ''}
        </div>
      </div>
      
      <div className="table-wrapper">
        <table className="applications-table">
          <thead>
            <tr className="table-header-row">
              <th className="table-head-applicant">Applicant Information</th>
              <th className="table-head-verification">Document Verification</th>
              <th className="table-head-verification">Selfie Verification</th>
              <th className="table-head-status">Status</th>
              <th className="table-head-reviewer">Reviewer</th>
              <th className="table-head-date">Created Date</th>
              {/* <th className="table-head-source">Source</th> */}
              <th className="table-head-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {dataToRender.map((applicant) => (
              <tr key={applicant.id} className="table-data-row">
                <td className="table-cell-applicant">
                  <div className="applicant-info">
                    <div className="applicant-avatar">
                      <div className="avatar-fallback">
                        {applicant.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                    </div>
                    <div className="applicant-details">
                      <div className="applicant-name">{applicant.name}</div>
                      <div className="applicant-id">ID: {applicant.id.substring(0, 8)}...</div>
                      <div className="applicant-meta">
                        <span className="country-flag"></span>
                        {applicant.country} • {applicant.documentType}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="table-cell-verification">
                  <div className="verification-status">
                    {applicant.status === "PENDING" ? (
                      <span className="badge verification-badge secondary">Not Verified</span>
                    ) : (
                      <span className={`badge verification-badge ${applicant.documents[0]?.verified ? "default" : "destructive"}`}>
                        {applicant.documents[0]?.verified ? "Verified" : "Failed"}
                      </span>
                    )}
                  </div>
                </td>

                <td className="table-cell-verification">
                  <div className="selfie-verification">
                    <div className="verification-score">
                      Liveness:{" "}
                      <span className={applicant.liveness > 80 ? "score-high" : "score-low"}>
                        {applicant.liveness}%
                      </span>
                    </div>
                    <div className="verification-score">
                      Matching:{" "}
                      <span className={applicant.matching > 80 ? "score-high" : "score-low"}>
                        {applicant.matching}%
                      </span>
                    </div>
                  </div>
                </td>

                <td className="table-cell-status">
                  <span className={`badge status-badge ${getStatusColor(applicant.status)}`}>
                    {getStatusIcon(applicant.status)}
                    {applicant.status}
                  </span>
                </td>

                <td className="table-cell-reviewer">
                  <div className="reviewer-info">
                    {applicant.reviewedBy ? (
                      <div className="reviewer-details">
                        <span className={applicant.reviewedBy === currentUserValue ? "current-reviewer" : "other-reviewer"}>
                          {applicant.reviewedBy === currentUserValue ? "" : applicant.reviewedBy}
                        </span>
                        {applicant.reviewedBy === currentUserValue && (
                          <span className="badge reviewer-badge outline">Mine</span>
                        )}
                      </div>
                    ) : (
                      <span className="no-reviewer">Unassigned</span>
                    )}
                  </div>
                </td>

                <td className="table-cell-date">
                  <div className="date-text">{applicant.createdDate}</div>
                </td>

                {/* <td className="table-cell-source">
                  <span className="badge source-badge outline">{applicant.source}</span>
                </td> */}

                <td className="table-cell-actions">
                  <div className="action-buttons">
                    <button className="button view-button outline sm" onClick={() => handleViewDetails(applicant)}>
                      <EyeIcon />
                    </button>

                    {applicant.status === "PENDING" && (
                      <button className="button claim-button sm" onClick={() => handleStartReview(applicant)}>
                        <PlayIcon />
                        Claim
                      </button>
                    )}

                    {applicant.status === "INREVIEW" && applicant.reviewedBy === currentUserValue && (
                      <button className="button continue-button outline sm" onClick={() => handleContinueReview(applicant)}>
                        Continue
                      </button>
                    )}

                    {applicant.status === "INREVIEW" && applicant.reviewedBy !== currentUserValue && (
                      <span className="badge locked-badge secondary">Locked</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <style jsx>{`
        /* Container styling */
        .applications-table-container {
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          background-color: white;
          margin: 1rem 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .table-header {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .table-header h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #1f2937;
        }
        
        .table-info {
          color: #6b7280;
          font-size: 0.875rem;
        }

        /* Table wrapper */
        .table-wrapper {
          overflow-x: auto;
        }
        
        /* Table styling */
        .applications-table {
          width: 100%;
          border-collapse: collapse;
        }

        /* Header row styling */
        .table-header-row {
          background-color: #f8f9fa;
          border-bottom: 2px solid #e9ecef;
        }

        .table-header-row:hover {
          background-color: #f8f9fa;
        }

        /* Table head styling */
        .table-header-row th {
          padding: 16px;
          font-weight: 600;
          color: #495057;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.5px;
          text-align: left;
        }

        /* Table cell styling */
        .table-data-row td {
          padding: 16px;
          vertical-align: middle;
          border-bottom: 1px solid #e9ecef;
        }

        .table-data-row:last-child td {
          border-bottom: none;
        }

        .table-data-row:hover {
          background-color: #f8fafc;
        }

        /* Applicant information cell */
        .table-cell-applicant {
          min-width: 250px;
        }

        .applicant-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .applicant-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .avatar-fallback {
          background-color: #6366f1;
          color: white;
          font-weight: 500;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .applicant-details {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .applicant-name {
          font-weight: 500;
          color: #1f2937;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .applicant-id {
          font-size: 0.75rem;
          color: #6b7280;
          margin-bottom: 2px;
        }

        .applicant-meta {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          color: #6b7280;
          white-space: nowrap;
        }

        .country-flag {
          display: inline-block;
          width: 16px;
          height: 12px;
          background-color: #ef4444;
          border-radius: 2px;
        }

        /* Verification cells */
        .table-cell-verification {
          min-width: 140px;
        }

        .verification-status, .selfie-verification {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .verification-badge {
          width: fit-content;
        }

        .verification-score {
          font-size: 0.875rem;
        }

        .score-high {
          color: #059669;
          font-weight: 500;
        }

        .score-low {
          color: #dc2626;
          font-weight: 500;
        }

        /* Status cell */
        .table-cell-status {
          min-width: 130px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 16px;
          font-size: 0.75rem;
          font-weight: 500;
          border: 1px solid;
        }

        .status-pending {
          background-color: #fef3c7;
          color: #92400e;
          border-color: #f59e0b;
        }

        .status-inreview {
          background-color: #dbeafe;
          color: #1e40af;
          border-color: #3b82f6;
        }

        .status-approved {
          background-color: #d1fae5;
          color: #065f46;
          border-color: #10b981;
        }

        .status-rejected {
          background-color: #fee2e2;
          color: #991b1b;
          border-color: #ef4444;
        }

        .status-default {
          background-color: #f3f4f6;
          color: #374151;
          border-color: #d1d5db;
        }

        /* Reviewer cell */
        .table-cell-reviewer {
          min-width: 120px;
        }

        .reviewer-details {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .current-reviewer {
          font-weight: 500;
          color: #2563eb;
        }

        .other-reviewer {
          color: #6b7280;
        }

        .no-reviewer {
          color: #9ca3af;
          font-style: italic;
        }

        .reviewer-badge {
          font-size: 0.7rem;
        }

        /* Date cell */
        .table-cell-date {
          min-width: 110px;
        }

        .date-text {
          font-size: 0.875rem;
        }

        /* Source cell */
        .table-cell-source {
          min-width: 100px;
        }

        /* Actions cell */
        .table-cell-actions {
          min-width: 150px;
        }

        .action-buttons {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Badge styles */
        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          line-height: 1;
        }

        .badge.default {
          background-color: #d1fae5;
          color: #065f46;
        }

        .badge.destructive {
          background-color: #fee2e2;
          color: #991b1b;
        }

        .badge.secondary {
          background-color: #f3f4f6;
          color: #374151;
        }

        .badge.outline {
          background-color: transparent;
          border: 1px solid #d1d5db;
          color: #374151;
        }

        /* Button styles */
        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .button.sm {
          padding: 6px 8px;
          font-size: 0.875rem;
        }

        .button.outline {
          background-color: transparent;
          border: 1px solid #d1d5db;
          color: #374151;
        }

        .button.outline:hover {
          background-color: #f9fafb;
        }

        .button:not(.outline) {
          border: none;
        }

        .view-button {
          color: #6b7280;
        }

        .view-button:hover {
          background-color: #f3f4f6;
        }

        .claim-button {
          background-color: #2563eb;
          color: white;
        }

        .claim-button:hover {
          background-color: #1d4ed8;
        }

        .continue-button {
          color: #2563eb;
          border-color: #2563eb;
        }

        .continue-button:hover {
          background-color: #dbeafe;
        }

        /* Icon styles */
        .button svg {
          width: 16px;
          height: 16px;
        }

        .status-badge svg {
          width: 14px;
          height: 14px;
        }
        
        /* Responsive styles */
        @media (max-width: 1200px) {
          .table-wrapper {
            overflow-x: auto;
          }
          
          .applications-table {
            min-width: 1000px;
          }
        }
      `}</style>
    </div>
  );
};

// Icon components
const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const XCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="15" y1="9" x2="9" y2="15"></line>
    <line x1="9" y1="9" x2="15" y2="15"></line>
  </svg>
);

const AlertCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
);

export default AllApplicationReviews;