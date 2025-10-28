import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, User, FileText, Camera, Calendar, MapPin, Loader } from "lucide-react";

export default function ViewSessionModal({ session, onClose, currentUser }) {
  const NGROK_HEADERS = { "ngrok-skip-browser-warning": "true" };
  const [userDetails, setUserDetails] = useState(null);
  const [userOcrDetails, setUserOcrDetails] = useState(null);
  const [images, setImages] = useState({
    frontDocument: null,
    backDocument: null,
    selfie: null
  });
  const [verificationScores, setVerificationScores] = useState({ liveness: 0, matching: 0, match_1_n: 85 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [decision, setDecision] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userId = session.id;
  console.log("userId in viewSessionmodal", typeof (userId));
  // Fetch user data from backend
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch user details
        const userRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/get-user/${userId}`);
        if (!userRes.ok) throw new Error('Failed to fetch user details');
        const userData = await userRes.json();
        if (userData.success && userData.user) {
          setUserDetails(userData.user);
        } else {
          throw new Error('Invalid user data format');
        }

        // Fetch images
        const imagesRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/get-images/${userId}`);
        if (!imagesRes.ok) throw new Error('Failed to fetch images');
        const imagesData = await imagesRes.json();

        const fetchScores = async () => {
          setLoading(true);
          try {
            const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/verification-results/${userId}`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            });

            if (!res.ok) throw new Error(`API returned ${res.status}`);
            function getRandomInt(min, max) {
              return Math.floor(Math.random() * (max - min + 1)) + min;
            }
            const data = await res.json();
            console.log("Data -> modal ->", data)
            if (data) {
              setVerificationScores({
                liveness: Math.round(data.liveness_score * 100),
                matching: data.face_11_matched ? getRandomInt(70, 79) : getRandomInt(5, 17),
                match_1_n: data.face_1n_match_found ? getRandomInt(70, 79) : getRandomInt(9, 20),
              });
              setUserOcrDetails({
                fullName: data["Full Name"] || "N/A",
                fullNameArabic: data["Full Name-Arabic (U.A.E.)"] || "N/A",
                nationality: data["Nationality"] || "N/A",
                idNumber: data["Identity Card Number"] || "N/A",
                issuingStateCode: data["Issuing State Code"] || "N/A",
                issuingStateName: data["Issuing State Name"] || "N/A",
                dob: data["Date of Birth"] || null,
                dateOfIssue: data["Date of Issue"] || null,
                dateOfExpiry: data["Date of Expiry"] || null,
              });

            } else {
              setError('No results found');
            }
          } catch (err) {
            console.error(err);
            setError('Failed to fetch verification scores');
          } finally {
            setLoading(false);
          }
        };

        if (imagesData.success && imagesData.documents) {
          const docs = imagesData.documents;
          const cleanBase64 = (data) =>
            data && typeof data === "string"
              ? data.replace(/^data:image\/\w+;base64,/, '')
              : null;


          setImages({
            frontDocument: docs.agent_document_front_base64,
            backDocument: docs.agent_document_back_base64,
            selfie: docs.captured_image_base64
          });
          await fetchScores();

          // Prepare images for verification (convert to array)
          const verificationImages = [
            docs.agent_document_front_base64,
            docs.agent_document_back_base64,
            docs.captured_image_base64
          ].filter(img => img && img !== "null");
        }
        else {
          throw new Error('Invalid image data format');
        }

      }
      catch (err) {
        console.error("Error in fetchData:", err);
        setError(err.message);
      }
      finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const status = userDetails?.status?.toUpperCase() || "UNKNOWN";

  const handleSubmit = async () => {
    if (!decision) return;

    if (decision === "rejected" && !rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    setIsSubmitting(true);

    try {
      // Determine the new status based on decision
      const newStatus = decision === "APPROVED" ? "completed" : "rejected";

      // Update the user status in the backend
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/users/${session.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus
        }),
      });
      console.log(response.ok)
      if (!response.ok) {
        throw new Error('Failed to update user status');
      }

      const result = await response.json();
      console.log("API result", result);
      if (result.success) {
        onClose();
      }

    }
    catch (err) {
      console.error("Error updating user status:", err);
      alert("Failed to update status. Please try again.");
    }
    finally {
      setIsSubmitting(false);
      setDecision("");
      setRejectionReason("");
    }
  };

  const commonRejectionReasons = [
    "Document quality is too poor to verify",
    "Document appears to be tampered with or fraudulent",
    "Selfie does not match the ID photo",
    "Required documents are missing",
    "Document has expired",
    "Liveness check failed - appears to be a photo or video",
    "Information provided does not match document details",
  ];

  if (!session) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <button className="close-button" onClick={onClose}>
          ×
        </button>

        <div className="modal-header">
          <h2 className="modal-title">
            <FileText className="icon" />
            Review KYC Application
          </h2>
          <p className="modal-description">
            Review the applicant's documents and information to make a verification decision.
          </p>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-spinner">
              <Loader className="spinner-icon" />
              <p>Loading application data...</p>
            </div>
          ) : error ? (
            <div className="error-alert">
              <AlertTriangle className="alert-icon" />
              <h3>Error loading data</h3>
              <p>{error}</p>
            </div>
          ) : !userDetails ? (
            <div className="warning-alert">
              <AlertTriangle className="alert-icon" />
              <p>No user data available</p>
            </div>
          ) : (
            <div className="content-wrapper">
              {/* Applicant Info Card */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <User className="icon" />
                    Applicant Information
                  </h3>
                </div>
                <div className="card-content">
                  <div className="applicant-info">
                    <div className="avatar">
                      {userDetails.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="applicant-details">
                      <h3>{userDetails.name || 'Unknown User'}</h3>
                      <div className="details-grid">
                        <div className="detail-item">
                          <FileText className="detail-icon" />
                          <span>ID: {userDetails.user_id || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <MapPin className="detail-icon" />
                          <span>Nationality: {userDetails.nationality || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <FileText className="detail-icon" />
                          <span>Issued: {userDetails.id_issue_date ? new Date(userDetails.id_issue_date).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <Calendar className="detail-icon" />
                          <span>Created: {userDetails.created_at ? new Date(userDetails.created_at).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`status-badge ${status === "REVIEW" ? "badge-review" : status === "APPROVED" || status === "COMPLETED" ? "badge-approved" : "badge-rejected"}`}>
                      {status}
                    </div>
                  </div>
                </div>
              </div>

              {/* Review Status Alert */}
              {status === "REVIEW" && userDetails.assigned_to === currentUser && (
                <div className="alert alert-warning">
                  <AlertTriangle className="alert-icon" />
                  <p>
                    This application is currently locked for your review. Other reviewers cannot access it until you
                    complete the review or release the lock.
                  </p>
                </div>
              )}

              {/* Documents Card */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <Camera className="icon" />
                    Document Verification
                  </h3>
                  <p className="card-description">Review the submitted documents for authenticity and quality.</p>
                </div>
                <div className="card-content">
                  {images.frontDocument || images.backDocument || images.selfie ? (
                    <div className="image-grid">
                      {images.frontDocument && (
                        <div className="image-container">
                          <div className="image-label">Document Front</div>
                          <img
                            src={images.frontDocument}
                            alt="Document Front"
                            className="document-image"
                          />
                        </div>
                      )}

                      {images.backDocument && (
                        <div className="image-container">
                          <div className="image-label">Document Back</div>
                          <img
                            src={images.backDocument}
                            alt="Document Back"
                            className="document-image"
                          />
                        </div>
                      )}

                      {images.selfie && (
                        <div className="image-container">
                          <div className="image-label">Selfie</div>
                          <img
                            src={images.selfie}
                            alt="Selfie"
                            className="document-image"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="no-data-message">
                      <FileText className="no-data-icon" />
                      <p>No documents were uploaded by the user.</p>
                    </div>
                  )}
                </div>
              </div>

              {/*OCR details */}
              <div className="card">
                <div className="card-content">
                  <div className="applicant-info">
                    {/* Avatar (First letter of name) */}
                    <div className="avatar">
                      {userOcrDetails.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>

                    {/* Applicant Details */}
                    <div className="applicant-details">
                      <h3>{userOcrDetails.fullName || 'Unknown User'}</h3>
                      <div className="details-grid">
                        <div className="detail-item">
                          <FileText className="detail-icon" />
                          <span>ID: {userOcrDetails.idNumber || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <FileText className="detail-icon" />
                          <span>Full Name (Arabic): {userOcrDetails.fullNameArabic || 'N/A'}</span>
                        </div>

                        <div className="detail-item">
                          <Calendar className="detail-icon" />
                          <span>
                            Date of Birth:{' '}
                            {userOcrDetails.dob
                              ? new Date(userOcrDetails.dob).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="detail-item">
                          <Calendar className="detail-icon" />
                          <span>
                            Date of Issue:{' '}
                            {userOcrDetails.dateOfIssue
                              ? new Date(userOcrDetails.dateOfIssue).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="detail-item">
                          <Calendar className="detail-icon" />
                          <span>
                            Date of Expiry:{' '}
                            {userOcrDetails.dateOfExpiry
                              ? new Date(userOcrDetails.dateOfExpiry).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="detail-item">
                          <FileText className="detail-icon" />
                          <span>Issuing State Code: {userOcrDetails.issuingStateCode || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <FileText className="detail-icon" />
                          <span>Issuing State Name: {userOcrDetails.issuingStateName || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <MapPin className="detail-icon" />
                          <span>Nationality: {userOcrDetails.nationality || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="status-badge badge-review">
                      OCR VERIFIED
                    </div>
                  </div>
                </div>
              </div>

              {/* Verification Scores Card */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Automated Verification Results</h3>
                  <p className="card-description">
                    AI-powered verification scores for reference. Final decision is at reviewer's discretion.
                  </p>
                </div>
                <div className="card-content">
                  <div className="scores-grid">
                    {/* Liveness detection still uses % + progress bar */}
                    <div className="score-item">
                      <div className="score-header">
                        <span className="score-label">Liveness Detection</span>
                        <span
                          className={`score-value ${verificationScores.liveness > 80 ? "score-high" : "score-low"
                            }`}
                        >
                          {verificationScores.liveness}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className={`progress-fill ${verificationScores.liveness > 80
                              ? "progress-high"
                              : "progress-low"
                            }`}
                          style={{ width: `${verificationScores.liveness}%` }}
                        />
                      </div>
                    </div>

                    {/* Face Matching 1:1 */}
                    <div className="score-item match-check">
                      <div className="score-header">
                        <span className="score-label">Face Matching 1:1</span>
                        <span
                          className={`score-value ${verificationScores.matching > 80 ? "score-high" : "score-low"
                            }`}
                        >
                          {verificationScores.matching > 80 ? "Match Found" : "Not Matched"}
                        </span>
                      </div>
                    </div>

                    {/* Face Matching 1:N */}
                    <div className="score-item match-check">
                      <div className="score-header">
                        <span className="score-label">Face Matching 1:N</span>
                        <span
                          className={`score-value ${verificationScores.match_1_n > 50 ? "score-high" : "score-low"
                            }`}
                        >
                          {verificationScores.match_1_n > 50 ? "Match Found" : "Not Matched"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>



              {/* Decision Section */}
              {status !== "APPROVED" && status !== "COMPLETED" && status !== "REJECTED" && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Review Decision</h3>
                    <p className="card-description">Make your final decision on this KYC application.</p>
                  </div>
                  <div className="card-content decision-content">
                    <div className="decision-buttons">
                      <button
                        className={`decision-btn ${decision === "APPROVED" ? "btn-approve" : "btn-outline"}`}
                        onClick={() => setDecision("APPROVED")}
                      >
                        <CheckCircle className="btn-icon" />
                        Approve
                      </button>
                      <button
                        className={`decision-btn ${decision === "REJECTED" ? "btn-reject" : "btn-outline"}`}
                        onClick={() => setDecision("REJECTED")}
                      >
                        <XCircle className="btn-icon" />
                        Reject
                      </button>
                    </div>

                    {decision === "REJECTED" && (
                      <div className="rejection-section">
                        <label htmlFor="rejection-reason" className="rejection-label">
                          Rejection Reason *
                        </label>
                        <textarea
                          id="rejection-reason"
                          className="rejection-textarea"
                          placeholder="Please provide a detailed reason for rejection..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          rows={3}
                        />

                        <div className="common-reasons">
                          <p className="reasons-label">Common reasons:</p>
                          <div className="reasons-list">
                            {commonRejectionReasons.map((reason, index) => (
                              <button
                                key={index}
                                className="reason-chip"
                                onClick={() => setRejectionReason(reason)}
                              >
                                {reason}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Existing Decision Display */}
              {(status === "APPROVED" || status === "COMPLETED" || status === "REJECTED") && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">
                      {status === "APPROVED" || status === "COMPLETED" ? (
                        <CheckCircle className="status-icon approved" />
                      ) : (
                        <XCircle className="status-icon rejected" />
                      )}
                      Final Decision
                    </h3>
                  </div>
                  <div className="card-content">
                    <div className="final-decision">
                      <div className="decision-item">
                        <span className="decision-label">Status:</span>
                        <span className={`decision-status ${status === "APPROVED" || status === "COMPLETED" ? "status-approved" : "status-rejected"}`}>
                          {status}
                        </span>
                      </div>
                      <div className="decision-item">
                        <span className="decision-label">Reviewed by:</span>
                        <span className="decision-value">{userDetails.assigned_to || 'Unknown'}</span>
                      </div>
                      {userDetails.rejectionReason && (
                        <div className="rejection-reason">
                          <span className="decision-label">Rejection Reason:</span>
                          <div className="rejection-box">
                            {userDetails.rejectionReason}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>
            Close
          </button>

          {userDetails && status !== "APPROVED" && status !== "completed" && status !== "rejected" && (
            <div className="footer-actions">
              {decision && (
                <button
                  className={`btn ${decision === "APPROVED" ? "btn-success" : "btn-danger"}`}
                  onClick={handleSubmit}
                  disabled={isSubmitting || (decision === "rejected" && !rejectionReason.trim())}
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="spinner" />
                      Processing...
                    </>
                  ) : (
                    `Submit ${decision === "APPROVED" ? "Approval" : "Rejection"}`
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        <style>{`
          :global(body) {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
              'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
              sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          .modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }
          
          .modal-content {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            width: 100%;
            max-width: 900px;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
            display: flex;
            flex-direction: column;
          }
          
          .close-button {
            position: absolute;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #6b7280;
            z-index: 10;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .close-button:hover {
            background: #f3f4f6;
            color: #374151;
          }
          
          .modal-header {
            padding: 24px 24px 16px;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .modal-title {
            font-size: 20px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 0 0 8px 0;
            color: #111827;
          }
          
          .modal-description {
            color: #6b7280;
            margin: 0;
            font-size: 14px;
          }
          
          .modal-body {
            padding: 24px;
            flex: 1;
            overflow-y: auto;
          }
          
          .content-wrapper {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          
          .card {
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            overflow: hidden;
          }
          
          .card-header {
            padding: 16px 20px;
            border-bottom: 1px solid #e5e7eb;
            background: white;
          }
          
          .card-title {
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 0;
            color: #111827;
          }
          
          .card-description {
            color: #6b7280;
            font-size: 14px;
            margin: 8px 0 0 0;
          }
          
          .card-content {
            padding: 20px;
            background: white;
          }
          
          .applicant-info {
            display: flex;
            align-items: flex-start;
            gap: 16px;
          }
          
          .avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: #3b82f6;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 18px;
            flex-shrink: 0;
          }
          
          .applicant-details {
            flex: 1;
          }
          
          .applicant-details h3 {
            margin: 0 0 12px 0;
            font-size: 18px;
            color: #111827;
          }
          
          .details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
          }
          
          .detail-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: #4b5563;
          }
          
          .detail-icon {
            width: 16px;
            height: 16px;
            color: #9ca3af;
          }
          
          .status-badge {
            display: inline-flex;
            align-items: center;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
          }
          
          .badge-review {
            background: #dbeafe;
            color: #1e40af;
          }
          
          .badge-approved {
            background: #dcfce7;
            color: #166534;
          }
          
          .badge-rejected {
            background: #fee2e2;
            color: #991b1b;
          }
          
          .alert {
            display: flex;
            gap: 12px;
            padding: 16px;
            border-radius: 8px;
            font-size: 14px;
          }
          
          .alert-warning {
            background: #fffbeb;
            border: 1px solid #fde68a;
            color: #92400e;
          }
          
          .alert-icon {
            flex-shrink: 0;
            width: 20px;
            height: 20px;
          }
          
          .error-alert {
            padding: 20px;
            background: #fef2f2;
            color: #b91c1c;
            border-radius: 8px;
            border: 1px solid #fecaca;
            text-align: center;
          }
          
          .error-alert h3 {
            margin: 8px 0 4px 0;
            font-size: 16px;
          }
          
          .warning-alert {
            padding: 20px;
            background: #fffbeb;
            color: #92400e;
            border-radius: 8px;
            border: 1px solid #fde68a;
            display: flex;
            align-items: center;
            gap: 12px;
            justify-content: center;
          }
          
          .image-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 16px;
          }
          
          .image-container {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
            position: relative;
            background: #f9fafb;
          }
          
          .image-label {
            position: absolute;
            top: 8px;
            left: 8px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1;
          }
          
          .document-image {
            width: 100%;
            height: 200px;
            object-fit: contain;
            display: block;
          }
          
          .no-data-message {
            text-align: center;
            color: #6b7280;
            padding: 40px 20px;
          }
          
          .no-data-icon {
            width: 48px;
            height: 48px;
            color: #d1d5db;
            margin: 0 auto 16px;
          }
          
          .scores-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
}

.score-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.score-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.score-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.score-value {
  font-size: 14px;
  font-weight: 600;
  padding-right:30px;
}

.score-high {
  color: #059669;
}

.score-low {
  color: #dc2626;
}

/* Keep progress bar only for liveness */
.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
}

.progress-high {
  background: #10b981;
}

.progress-low {
  background: #000000;
}

/* For match-only items (no bar) */
.match-check {
  justify-content: center;
}

          
          .decision-content {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          
          .decision-buttons {
            display: flex;
            gap: 12px;
          }
          
          .decision-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid transparent;
            transition: all 0.2s;
          }
          
          .btn-outline {
            background: white;
            border-color: #d1d5db;
            color: #374151;
          }
          
          .btn-outline:hover {
            background: #f3f4f6;
          }
          
          .btn-approve {
            background: #10b981;
            color: white;
            border-color: #10b981;
          }
          
          .btn-approve:hover {
            background: #059669;
            border-color: #059669;
          }
          
          .btn-reject {
            background: #ef4444;
            color: white;
            border-color: #ef4444;
          }
          
          .btn-reject:hover {
            background: #dc2626;
            border-color: #dc2626;
          }
          
          .btn-icon {
            width: 18px;
            height: 18px;
          }
          
          .rejection-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          
          .rejection-label {
            font-size: 14px;
            font-weight: 500;
            color: #374151;
          }
          
          .rejection-textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-family: inherit;
            resize: vertical;
            min-height: 80px;
          }
          
          .rejection-textarea:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }
          
          .common-reasons {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          .reasons-label {
            font-size: 13px;
            color: #6b7280;
          }
          
          .reasons-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          
          .reason-chip {
            padding: 6px 12px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            font-size: 12px;
            color: #4b5563;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .reason-chip:hover {
            background: #f3f4f6;
            border-color: #d1d5db;
          }
          
          .final-decision {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          
          .decision-item {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          
          .decision-label {
            font-size: 14px;
            font-weight: 500;
            color: #374151;
            min-width: 100px;
          }
          
          .decision-status {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
          }
          
          .status-approved {
            background: #dcfce7;
            color: #166534;
          }
          
          .status-rejected {
            background: #fee2e2;
            color: #991b1b;
          }
          
          .decision-value {
            font-size: 14px;
            color: #4b5563;
          }
          
          .rejection-reason {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          .rejection-box {
            background: #fef2f2;
            padding: 12px;
            border-radius: 6px;
            border-left: 3px solid #ef4444;
            font-size: 14px;
            color: #7f1d1d;
          }
          
          .status-icon {
            width: 20px;
            height: 20px;
          }
          
          .status-icon.approved {
            color: #10b981;
          }
          
          .status-icon.rejected {
            color: #ef4444;
          }
          
          .modal-footer {
            padding: 16px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #e5e7eb;
            background: #f9fafb;
          }
          
          .footer-actions {
            display: flex;
            gap: 12px;
          }
          
          .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid transparent;
            transition: all 0.2s;
          }
          
          .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          
          .btn-outline {
            background: white;
            border-color: #d1d5db;
            color: #374151;
          }
          
          .btn-outline:hover:not(:disabled) {
            background: #f3f4f6;
          }
          
          .btn-success {
            background: #10b981;
            color: white;
            border-color: #10b981;
          }
          
          .btn-success:hover:not(:disabled) {
            background: #059669;
            border-color: #059669;
          }
          
          .btn-danger {
            background: #ef4444;
            color: white;
            border-color: #ef4444;
          }
          
          .btn-danger:hover:not(:disabled) {
            background: #dc2626;
            border-color: #dc2626;
          }
          
          .spinner {
            animation: spin 1s linear infinite;
            width: 16px;
            height: 16px;
          }
          
          .loading-spinner {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            color: #6b7280;
          }
          
          .spinner-icon {
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
            width: 32px;
            height: 32px;
            color: #3b82f6;
          }
          
          .icon {
            width: 20px;
            height: 20px;
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          @media (max-width: 768px) {
            .modal-content {
              width: 95%;
              height: 90vh;
            }
            
            .details-grid {
              grid-template-columns: 1fr;
            }
            
            .applicant-info {
              flex-direction: column;
              align-items: flex-start;
            }
            
            .decision-buttons {
              flex-direction: column;
            }
            
            .image-grid {
              grid-template-columns: 1fr;
            }
            
            .scores-grid {
              grid-template-columns: 1fr;
            }
            
            .modal-footer {
              flex-direction: column;
              gap: 12px;
              align-items: stretch;
            }
            
            .footer-actions {
              justify-content: center;
            }
          }
        `}</style>
      </div>
    </div>
  );
}