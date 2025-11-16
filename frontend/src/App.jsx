import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import General from './components/general';
import Medical from './components/medical';
import Overview from './components/overview';
import Herds from './components/herds';
import Fieldsheets from './components/fieldsheets';
import Login from './components/login';
import BreedingPlan from './components/breedingPlan'; 
import Layout from './components/layout';
import TimeoutPopup from './components/timeoutPopup';
import { userSessionManager } from './userSessionManager';
import { setSessionExpiredCallback } from './apiInterceptor';
import AnimalFolder from './components/animalFolder';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSessionExpired, setShowSessionExpired] = useState(false);

  const {
    showTimeoutWarning,
    remainingTime,
    handleExtendSession,
    handleTimeoutClose
  } = userSessionManager(isAuthenticated);

  useEffect(() => {
    checkAuth();

    // Set up the session expired callback for API interceptor
    setSessionExpiredCallback(() => {
      setIsAuthenticated(false);
      setShowSessionExpired(true);
    });
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

  const handleSessionExpiredClose = () => {
    setShowSessionExpired(false);
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
    <>
      <Router>
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/general" replace /> : <Login />}
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
            path="/animal"
            element={
              isAuthenticated
                ? <Layout><AnimalFolder /></Layout>
                : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/general"
            element={<Navigate to="/animal?tab=general" replace />}
          />
          <Route
            path="/medical"
            element={<Navigate to="/animal?tab=medical" replace />}
          />
          <Route
            path="/breeding"
            element={
              isAuthenticated
                ? <Layout><BreedingPlan /></Layout>
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
          <Route
            path="/"
            element={isAuthenticated ? <Navigate to="/animal" replace /> : <Navigate to="/login" replace />}
          />

          {/* Update the catch-all redirect */}
          <Route path="*" element={<Navigate to="/animal" replace />} />
        </Routes>
      </Router>

      {/* Combined Session Management Popup */}
      <TimeoutPopup
        isOpen={showTimeoutWarning || showSessionExpired}
        onClose={showSessionExpired ? handleSessionExpiredClose : handleTimeoutClose}
        onExtend={handleExtendSession}
        initialCountdown={remainingTime ? Math.ceil(remainingTime / 1000) : 60}
      />
    </>
  );
}

export default App;