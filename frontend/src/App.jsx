import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import General from './components/general';
import Medical from './components/medical';
import Overview from './components/overview';
import Herds from './components/herds';
import Fieldsheets from './components/fieldsheets';
import Login from './components/login';
import Layout from './components/layout';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/check-auth', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public route */}
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/general" replace /> : <Login />} 
        />
        
        {/* Protected routes */}
        <Route
          path="/"
          element={isAuthenticated ? <Navigate to="/general" replace /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/overview"
          element={
            isAuthenticated 
              ? <Layout><Overview /></Layout> 
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/general"
          element={
            isAuthenticated 
              ? <Layout><General /></Layout> 
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/medical"
          element={
            isAuthenticated 
              ? <Layout><Medical /></Layout> 
              : <Navigate to="/login" replace />
          }
          />
          <Route
          path="/herds"
          element={
            isAuthenticated 
              ? <Layout><Herds /></Layout> 
              : <Navigate to="/login" replace />
          }
          />
          <Route
          path="/fieldsheets"
          element={
            isAuthenticated 
              ? <Layout><Fieldsheets /></Layout> 
              : <Navigate to="/login" replace />
          }
          />
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/general" replace />} />
      </Routes>
    </Router>
  );
}

export default App;