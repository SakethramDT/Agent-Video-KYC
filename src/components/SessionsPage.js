// src/components/SessionsPage.jsx
import React from 'react';
import Header from './Header';
import StatsGrid from './StatsGrid';
import TabContainer from './TabContainer';
import SessionsList from './SessionsList';

const SessionsPage = ({
  loggedInAgent,
  getStatusBadgeStyle,
  getRiskBadgeStyle,
  getAgentStatusDotStyle
}) => {
  const normalized = (loggedInAgent || localStorage.getItem('kycAgent') || '').toLowerCase().replace(/\s/g, '');
  const isAdmin = normalized === 'admin';

  // Admin view: show full dashboard layout + SessionsList
  if (isAdmin) {
    return (
      <div className="kyc-container">
         
        <div className="kyc-main-content" style={{ padding: 20 }}>
          <div className="kyc-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h2 className="kyc-page-title">Officer Dashboard — Sessions</h2>
              <p className="kyc-page-subtitle">All agent sessions and stats (admin view).</p>
            </div>
          </div>

          {/* Keep dashboard widgets (stats + tabs) */}
          <StatsGrid agent={loggedInAgent} />

          <TabContainer
            getStatusBadgeStyle={getStatusBadgeStyle}
            getRiskBadgeStyle={getRiskBadgeStyle}
            getAgentStatusDotStyle={getAgentStatusDotStyle}
            loggedInAgent={loggedInAgent}
          />

          {/* Sessions list (inside admin layout) */}
          {/* <div style={{ marginTop: 18 }}>
            <SessionsList
              loggedInAgent={loggedInAgent}
              getStatusBadgeStyle={getStatusBadgeStyle}
              getRiskBadgeStyle={getRiskBadgeStyle}
            />
          </div> */}
        </div>
      </div>
    );
  }
   
//   // Non-admin: show SessionsList only (existing behaviour)
//   return (
    
//     <div style={{ padding: 20 }}>
//          <Header />
//       <SessionsList
//         loggedInAgent={loggedInAgent}
//         getStatusBadgeStyle={getStatusBadgeStyle}
//         getRiskBadgeStyle={getRiskBadgeStyle}
//       />
//     </div>
//   );

};

export default SessionsPage;
