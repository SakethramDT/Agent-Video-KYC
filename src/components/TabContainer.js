import React, { useState } from 'react';
import SessionsList from './SessionsList';
import AvailableReviews from './AvailableReviews';
import AllAvailableReviews from './AllAvailableReviews';
import MyReviews from './MyReviews'
const TabContainer = ({
  getStatusBadgeStyle,
  getRiskBadgeStyle,
  loggedInAgent 
}) => {
  const [activeTab, setActiveTab] = useState('sessions');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [searchTerm, setSearchTerm] = useState('');
  
  return (
    <div className="kyc-tab-container">
      <div className="kyc-tab-nav">
        <nav className="kyc-tab-nav-inner">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`kyc-tab-button ${activeTab === 'sessions' ? 'active' : ''}`}
          >
            Available Calls
          </button>
          
          {/* <button
            onClick={() => setActiveTab('review')}
            className={`kyc-tab-button ${activeTab === 'review' ? 'active' : ''}`}
          >
            Available Reviews
          </button> */}
          <button
            onClick={() => setActiveTab('myreviews')}
            className={`kyc-tab-button ${activeTab === 'myreviews' ? 'active' : ''}`}
          >
            My Reviews
          </button>
          {/* <button
            onClick={() => setActiveTab('analytics')}
            className={`kyc-tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
          >
            All Applications
          </button> */}
        </nav>
      </div>

      <div className="kyc-tab-content">
        {activeTab === 'sessions' && (
          <SessionsList
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            getStatusBadgeStyle={getStatusBadgeStyle}
            getRiskBadgeStyle={getRiskBadgeStyle}
            loggedInAgent={loggedInAgent}
          />
        )}
        {activeTab === 'myreviews' && (
          <MyReviews
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            getStatusBadgeStyle={getStatusBadgeStyle}
            getRiskBadgeStyle={getRiskBadgeStyle}
            loggedInAgent={loggedInAgent}
          />
        )}


        {activeTab === 'review' && (
          <AvailableReviews
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            getStatusBadgeStyle={getStatusBadgeStyle}
            getRiskBadgeStyle={getRiskBadgeStyle}
            loggedInAgent={loggedInAgent}
          />
        )}

        {activeTab === 'analytics' &&( <AllAvailableReviews
          searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            getStatusBadgeStyle={getStatusBadgeStyle}
            getRiskBadgeStyle={getRiskBadgeStyle}
            loggedInAgent={loggedInAgent}
        />
      )}
      </div>
    </div>
  );
};

export default TabContainer;
