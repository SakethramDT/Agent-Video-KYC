import React, { useEffect, useState } from 'react';
import { Users, Clock, CheckCircle, TrendingUp } from 'lucide-react';

const StatsGrid = (agent) => {
  const [stats, setStats] = useState({
    total_sessions: 0,
    pending_sessions: 0,
    completed_today: 0,
    rejection_rate: '0%',
  });

  const agentName=agent.agent || '';
  console.log(agentName);
  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/agent/users/stats?agent=${encodeURIComponent(agentName)}`);
        const fullUrl = `${process.env.REACT_APP_BACKEND_URL}/agent/users/stats?agent=${encodeURIComponent(agentName)}`;
        console.log("Fetching from:", fullUrl);
        const data = await response.json();
        setStats(data);
        console.log(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    }

    fetchStats(); // initial fetch

    const intervalId = setInterval(() => {
      fetchStats();
    }, 5000); // every 5 seconds

    return () => clearInterval(intervalId); // cleanup on unmount
  }, []);

  return (
    <div className="kyc-stats-grid">
      <div className="kyc-stat-card kyc-stat-card-blue">
        <div className="kyc-stat-content">
          <div>
            <p className="kyc-stat-label" style={{ color: '#2563eb' }}>Total Sessions</p>
            <p className="kyc-stat-value" style={{ color: '#1e3a8a' }}>{stats.total_sessions}</p>
          </div>
          <div className="kyc-stat-icon" style={{ backgroundColor: '#bfdbfe' }}>
            <Users size={24} color="#2563eb" />
          </div>
        </div>
      </div>

      <div className="kyc-stat-card kyc-stat-card-yellow">
        <div className="kyc-stat-content">
          <div>
            <p className="kyc-stat-label" style={{ color: '#d97706' }}>Pending</p>
            <p className="kyc-stat-value" style={{ color: '#92400e' }}>{stats.pending_sessions}</p>
          </div>
          <div className="kyc-stat-icon" style={{ backgroundColor: '#fed7aa' }}>
            <Clock size={24} color="#d97706" />
          </div>
        </div>
      </div>

      <div className="kyc-stat-card kyc-stat-card-green">
        <div className="kyc-stat-content">
          <div>
            <p className="kyc-stat-label" style={{ color: '#059669' }}>Total Completed</p>
            <p className="kyc-stat-value" style={{ color: '#064e3b' }}>{stats.completed_today}</p>
          </div>
          <div className="kyc-stat-icon" style={{ backgroundColor: '#bbf7d0' }}>
            <CheckCircle size={24} color="#059669" />
          </div>
        </div>
      </div>

      <div className="kyc-stat-card kyc-stat-card-purple">
        <div className="kyc-stat-content">
          <div>
            <p className="kyc-stat-label" style={{ color: '#7c3aed' }}>Rejection Rate</p>
            <p className="kyc-stat-value" style={{ color: '#581c87' }}>{stats.rejection_rate}</p>
          </div>
          <div className="kyc-stat-icon" style={{ backgroundColor: '#c4b5fd' }}>
            <TrendingUp size={24} color="#7c3aed" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsGrid;
