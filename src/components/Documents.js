import React, { useState, useEffect } from 'react';
 
const DocumentManagement = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All Types');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [selectedDocs, setSelectedDocs] = useState(new Set());

  // Fetch documents from API (mocked in this demo)
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);

      // In a real app you'd fetch from an API:
      // const response = await fetch('/api/documents');
      // const data = await response.json();

      // Mock data for demo
      const mockData = [
        // { id: 1, customer: 'Unknown', documentType: 'National ID', uploadDate: 'Sep 24, 2025', uploadTime: '10:23', status: 'verified', qualityScore: 95 },
        // { id: 2, customer: 'Unknown', documentType: 'Selfie Photo', uploadDate: 'Sep 24, 2025', uploadTime: '10:23', status: 'verified', qualityScore: 88 },
        // { id: 3, customer: 'Unknown', documentType: 'Passport', uploadDate: 'Sep 24, 2025', uploadTime: '10:23', status: 'requires review', qualityScore: 76 },
        // { id: 4, customer: 'Unknown', documentType: 'Utility Bill', uploadDate: 'Sep 24, 2025', uploadTime: '10:23', status: 'pending', qualityScore: 82 },
        // { id: 5, customer: 'Unknown', documentType: "Driver's License", uploadDate: 'Sep 24, 2025', uploadTime: '10:23', status: 'rejected', qualityScore: 45 },
        // { id: 6, customer: 'Unknown', documentType: 'National ID', uploadDate: 'Sep 24, 2025', uploadTime: '08:30', status: 'verified', qualityScore: 95 },
        // { id: 7, customer: 'Unknown', documentType: 'Selfie Photo', uploadDate: 'Sep 24, 2025', uploadTime: '08:30', status: 'verified', qualityScore: 88 },
        // { id: 8, customer: 'Unknown', documentType: 'Passport', uploadDate: 'Sep 24, 2025', uploadTime: '08:30', status: 'requires review', qualityScore: 76 }
      ];

      // simulate network latency (optional)
      setTimeout(() => {
        setDocuments(mockData);
        setLoading(false);
      }, 350);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = {
    total: documents.length,
    pending: documents.filter(d => d.status === 'pending').length,
    verified: documents.filter(d => d.status === 'verified').length,
    rejected: documents.filter(d => d.status === 'rejected').length,
    requiresReview: documents.filter(d => d.status === 'requires review').length,
    nationalIds: documents.filter(d => d.documentType === 'National ID').length
  };

  // Filter documents
  const filteredDocs = documents.filter(doc => {
    const matchesSearch =
      doc.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.documentType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'All Types' || doc.documentType === filterType;
    const matchesStatus = filterStatus === 'All Status' || doc.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Handle checkbox selection
  const handleSelectDoc = (id) => {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedDocs(newSelected);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedDocs(new Set(filteredDocs.map(d => d.id)));
    else setSelectedDocs(new Set());
  };

  // Get status badge styling
  const getStatusStyle = (status) => {
    const styles = {
      verified: { bg: '#d1f4e0', color: '#0d9f5f', icon: '✓' },
      pending: { bg: '#fff4e5', color: '#d97706', icon: '⏱' },
      rejected: { bg: '#fee', color: '#dc2626', icon: '✕' },
      'requires review': { bg: '#fff4e5', color: '#d97706', icon: '⚠' }
    };
    return styles[status] || styles.pending;
  };

  // Get quality score color
  const getQualityColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#f59e0b';
    return '#ef4444';
  };

  // small SVG/icon components (kept inline for simplicity)
  const TotalDocsIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 2V8H20" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 13H8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 17H8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 9H9H8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const PendingIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="2"/>
      <path d="M12 6V12L16 14" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const VerifiedIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.7088 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 4L12 14.01L9 11.01" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const RejectedIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/>
      <path d="M15 9L9 15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
      <path d="M9 9L15 15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );

  const ReviewIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M10.29 3.86L1.82 18C1.64537 18.3024 1.55296 18.6453 1.55199 18.9945C1.55101 19.3437 1.64151 19.6871 1.81445 19.9905C1.98738 20.2939 2.23675 20.5467 2.53773 20.7239C2.83871 20.901 3.18082 20.9962 3.53 21H20.47C20.8192 20.9962 21.1613 20.901 21.4623 20.7239C21.7633 20.5467 22.0126 20.2939 22.1856 19.9905C22.3585 19.6871 22.449 19.3437 22.448 18.9945C22.447 18.6453 22.3546 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32312 12.9812 3.15448C12.6817 2.98585 12.3437 2.89725 12 2.89725C11.6563 2.89725 11.3183 2.98585 11.0188 3.15448C10.7193 3.32312 10.4683 3.56611 10.29 3.86Z" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 9V13" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="17" r="0.5" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2"/>
    </svg>
  );

  const NationalIdIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="20" height="12" rx="2" stroke="#8b5cf6" strokeWidth="2"/>
      <circle cx="8" cy="12" r="2" stroke="#8b5cf6" strokeWidth="2"/>
      <path d="M14 10H18" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round"/>
      <path d="M14 14H18" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );

  const getDocTypeIcon = (type) => {
    if (type.includes('Photo')) return '📷';
    if (type.includes('Passport')) return '📘';
    if (type.includes('License')) return '🚗';
    if (type.includes('Bill')) return '📄';
    return '🆔';
  };

  // Inline CSS styles object
  const styles = {
    container: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '32px',
      background: '#f3f6fb',
      minHeight: '100vh',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '28px'
    },
    title: {
      fontSize: '28px',
      fontWeight: 700,
      color: '#0f172a',
      margin: '0 0 6px 0'
    },
    subtitle: {
      fontSize: '13px',
      color: '#6b7280',
      margin: 0
    },
    headerButtons: {
      display: 'flex',
      gap: '12px'
    },
    exportBtn: {
      padding: '10px 18px',
      background: 'white',
      border: '1px solid #e6e9ef',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      color: '#374151'
    },
    uploadBtn: {
      padding: '10px 18px',
      background: '#2563eb',
      border: 'none',
      borderRadius: '8px',
      color: 'white',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '18px',
      marginBottom: '24px'
    },
    statCard: {
      background: 'white',
      padding: '18px',
      borderRadius: '14px',
      display: 'flex',
      gap: '12px',
      border: '1px solid #eef2f6',
      alignItems: 'center'
    },
    statCardBlue: { background: 'linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%)', borderColor: '#e6eefc' },
    statCardYellow: { background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)', borderColor: '#fff3c4' },
    statCardGreen: { background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)', borderColor: '#dff7e9' },
    statCardRed: { background: 'linear-gradient(135deg, #ffffff 0%, #fff5f5 100%)', borderColor: '#fddede' },
    statCardOrange: { background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)', borderColor: '#fde7c8' },
    statCardPurple: { background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)', borderColor: '#f0e9ff' },
    statIconWrapper: { width: '52px', height: '52px', borderRadius: '12px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    statContent: { flex: 1, minWidth: 0 },
    statLabel: { fontSize: '13px', color: '#6b7280', marginBottom: '6px', fontWeight: 600 },
    statValue: { fontSize: '22px', fontWeight: 800, color: '#0f172a' },
    statSubtext: { fontSize: '12px', color: '#9ca3af' },

    searchSection: { display: 'flex', gap: '12px', marginBottom: '18px', alignItems: 'center' },
    searchWrapper: { flex: 1, position: 'relative' },
    searchIcon: { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.7 },
    searchInput: { width: '100%', padding: '10px 14px 10px 40px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', background: 'white', boxSizing: 'border-box' },
    filterSelect: { padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', fontSize: '14px', minWidth: '150px' },

    tableCard: { marginTop: '6px', background: 'white', padding: '18px', borderRadius: '12px', border: '1px solid #eef2f6' },
    tableTitle: { margin: '0 0 12px 0', fontSize: '16px', color: '#0f172a' },
    loading: { padding: '20px', color: '#6b7280' },
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '920px' },
    tableHeaderRow: { textAlign: 'left', borderBottom: '1px solid #eef2f6' },
    tableHeader: { padding: '12px 10px', fontSize: '13px', color: '#6b7280', verticalAlign: 'middle' },
    checkbox: { width: '16px', height: '16px', cursor: 'pointer' },
    tableRow: { borderBottom: '1px solid #f3f4f6' },
    tableCell: { padding: '12px 10px', verticalAlign: 'middle', fontSize: '14px', color: '#111827' },

    customerCell: { display: 'flex', alignItems: 'center', gap: '10px' },
    avatar: { width: '36px', height: '36px', borderRadius: '50%', background: '#eef2ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
    docTypeCell: { display: 'flex', alignItems: 'center', gap: '8px' },
    docTypeIcon: { fontSize: '18px' },
    docTypeLabel: { padding: '6px 10px', background: '#f8fafc', borderRadius: '10px', fontSize: '13px', color: '#374151' },

    date: { fontWeight: 600, color: '#0f172a' },
    time: { fontSize: '12px', color: '#9ca3af' },

    statusBadge: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '999px', fontSize: '13px', fontWeight: 600 },
    statusIcon: { display: 'inline-block', fontSize: '12px' },

    qualityCell: { display: 'flex', alignItems: 'center', gap: '10px' },
    qualityDot: { width: '10px', height: '10px', borderRadius: '50%' },
    qualityText: { fontWeight: 700 },

    actionButtons: { display: 'flex', gap: '8px' },
    actionBtn: { padding: '8px 10px', borderRadius: '8px', border: '1px solid #e6e9ef', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '13px' }
  };

  const customCSS = `
    .btn-hover:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.08); }
    .stat-card-hover { transition: all 0.25s ease; cursor: pointer; }
    .stat-card-hover:hover { transform: translateY(-6px); box-shadow: 0 12px 30px rgba(0,0,0,0.08); }
    .table-row-hover:hover { background: #f8fafc !important; }
    .action-btn-hover:hover { background: #f3f4f6; border-color: #d1d5db; }
  `;

  return (
    <div style={styles.container}>
      <style>{customCSS}</style>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Document Management</h1>
          <p style={styles.subtitle}>Review and manage all IDV documents</p>
        </div>
        <div style={styles.headerButtons}>
          <button style={styles.exportBtn} className="btn-hover">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export Documents
          </button>
          <button style={styles.uploadBtn} className="btn-hover">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 8L12 3L7 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 3V15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Upload Documents
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <div style={{ ...styles.statCard, ...styles.statCardBlue }} className="stat-card-hover">
          <div style={styles.statIconWrapper}><TotalDocsIcon /></div>
          <div style={styles.statContent}>
            <div style={styles.statLabel}>Total Documents</div>
            <div style={styles.statValue}>{stats.total}</div>
            <div style={styles.statSubtext}>All types</div>
          </div>
        </div>

        <div style={{ ...styles.statCard, ...styles.statCardYellow }} className="stat-card-hover">
          <div style={styles.statIconWrapper}><PendingIcon /></div>
          <div style={styles.statContent}>
            <div style={styles.statLabel}>Pending Review</div>
            <div style={styles.statValue}>{stats.pending}</div>
            <div style={styles.statSubtext}>Awaiting processing</div>
          </div>
        </div>

        <div style={{ ...styles.statCard, ...styles.statCardGreen }} className="stat-card-hover">
          <div style={styles.statIconWrapper}><VerifiedIcon /></div>
          <div style={styles.statContent}>
            <div style={styles.statLabel}>Verified</div>
            <div style={styles.statValue}>{stats.verified}</div>
            <div style={styles.statSubtext}>Successfully verified</div>
          </div>
        </div>

        <div style={{ ...styles.statCard, ...styles.statCardRed }} className="stat-card-hover">
          <div style={styles.statIconWrapper}><RejectedIcon /></div>
          <div style={styles.statContent}>
            <div style={styles.statLabel}>Rejected</div>
            <div style={styles.statValue}>{stats.rejected}</div>
            <div style={styles.statSubtext}>Failed verification</div>
          </div>
        </div>

        <div style={{ ...styles.statCard, ...styles.statCardOrange }} className="stat-card-hover">
          <div style={styles.statIconWrapper}><ReviewIcon /></div>
          <div style={styles.statContent}>
            <div style={styles.statLabel}>Requires Review</div>
            <div style={styles.statValue}>{stats.requiresReview}</div>
            <div style={styles.statSubtext}>Manual review needed</div>
          </div>
        </div>

        {/* <div style={{ ...styles.statCard, ...styles.statCardPurple }} className="stat-card-hover">
          <div style={styles.statIconWrapper}><NationalIdIcon /></div>
          <div style={styles.statContent}>
            <div style={styles.statLabel}>National IDs</div>
            <div style={styles.statValue}>{stats.nationalIds}</div>
            <div style={styles.statSubtext}>Primary ID docs</div>
          </div>
        </div> */}
      </div>

      {/* Search and filters */}
      <div style={styles.searchSection}>
        <div style={styles.searchWrapper}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={styles.searchIcon}>
            <circle cx="11" cy="11" r="8" stroke="#9ca3af" strokeWidth="2"/>
            <path d="M21 21L16.65 16.65" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
          </svg>

          <input
            type="text"
            placeholder="Search documents by customer name, email, or document type..."
            style={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select style={styles.filterSelect} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option>All Types</option>
          <option>National ID</option>
          <option>Passport</option>
          <option>Selfie Photo</option>
          <option>Utility Bill</option>
          <option>Driver's License</option>
        </select>

        <select style={styles.filterSelect} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option>All Status</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="requires review">Requires Review</option>
        </select>
      </div>

      {/* Documents table */}
      <div style={styles.tableCard}>
        <h3 style={styles.tableTitle}>Documents ({filteredDocs.length})</h3>

        {loading ? (
          <div style={styles.loading}>Loading documents...</div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.tableHeader}>
                    <input
                      type="checkbox"
                      style={styles.checkbox}
                      onChange={handleSelectAll}
                      checked={selectedDocs.size === filteredDocs.length && filteredDocs.length > 0}
                    />
                  </th>
                  <th style={styles.tableHeader}>Customer</th>
                  <th style={styles.tableHeader}>Document Type</th>
                  <th style={styles.tableHeader}>Upload Date</th>
                  <th style={styles.tableHeader}>Status</th>
                  <th style={styles.tableHeader}>Quality Score</th>
                  <th style={styles.tableHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => {
                  const statusStyle = getStatusStyle(doc.status);
                  return (
                    <tr key={doc.id} className="table-row-hover" style={styles.tableRow}>
                      <td style={styles.tableCell}>
                        <input
                          type="checkbox"
                          style={styles.checkbox}
                          checked={selectedDocs.has(doc.id)}
                          onChange={() => handleSelectDoc(doc.id)}
                        />
                      </td>
                      <td style={styles.tableCell}>
                        <div style={styles.customerCell}>
                          <div style={styles.avatar}>?</div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{doc.customer}</div>
                            <div style={{ fontSize: 12, color: '#9ca3af' }}>—</div>
                          </div>
                        </div>
                      </td>
                      <td style={styles.tableCell}>
                        <div style={styles.docTypeCell}>
                          <div style={styles.docTypeIcon}>{getDocTypeIcon(doc.documentType)}</div>
                          <div style={{ fontWeight: 600 }}>{doc.documentType}</div>
                        </div>
                      </td>
                      <td style={styles.tableCell}>
                        <div>
                          <div style={styles.date}>{doc.uploadDate}</div>
                          <div style={styles.time}>{doc.uploadTime}</div>
                        </div>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{ ...styles.statusBadge, background: statusStyle.bg, color: statusStyle.color }}>
                          <span style={styles.statusIcon}>{statusStyle.icon}</span>
                          <span style={{ textTransform: 'capitalize' }}>{doc.status}</span>
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        <div style={styles.qualityCell}>
                          <div style={{ ...styles.qualityDot, background: getQualityColor(doc.qualityScore) }} />
                          <div style={styles.qualityText}>{doc.qualityScore}%</div>
                        </div>
                      </td>
                      <td style={styles.tableCell}>
                        <div style={styles.actionButtons}>
                          <button style={styles.actionBtn} className="action-btn-hover">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                              <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2"/>
                              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                            View
                          </button>
                          <button style={styles.actionBtn} className="action-btn-hover">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                              <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" strokeWidth="2"/>
                              <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                            Session
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentManagement;
