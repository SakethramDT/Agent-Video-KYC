import React from 'react';
import logo from './logo.png'
const Header = () => {
  return (
    <div className="kyc-header">
      <div className="kyc-header-content">
        <div className="kyc-logo-section">
           
          <img
            src={logo}
            alt="S"
            className="kyc-logo-image"
          />
          <div className="kyc-logo-text">
            <h1 className="kyc-logo-title">Secure KYC</h1>
            <p className="kyc-logo-subtitle">Video Verification Platform</p>
          </div>
        </div>
        <div className="kyc-status-indicator">
          <div className="kyc-status-dot"></div>
          <span className="kyc-status-text">System Online</span>
        </div>
      </div>
    </div>

  );
};

export default Header;