// src/components/ProtectedRouteAdmin.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRouteAdmin({ children, loggedInAgent }) {
  const isAdmin = (loggedInAgent || '').toLowerCase().replace(/\s/g, '') === 'admin';
  if (!isAdmin) {
    // redirect non-admins to home or login
    return <Navigate to="/not-authorized" replace />;
  }
  return children;
}
