import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import General from './components/general';
import Medical from './components/medical';
import Overview from './components/overview';
import Herds from './components/herds';
import Fieldsheets from './components/fieldsheets';
import Login from './components/login';
import Register from './components/registerUser';
import DevMenu from './components/devMenu';
import SetPassword from './components/setPassword';
import BreedingPlan from './components/breedingPlan'; 
import Layout from './components/layout';
import TimeoutPopup from './components/timeoutPopup';
import UserManagement from './components/userManagement';
import { userSessionManager } from './userSessionManager';
import { setSessionExpiredCallback } from './apiInterceptor';
import AnimalFolder from './components/animalFolder';

function App() {
  const [authState, setAuthState] = useState('checking'); // checking, needsRegistration, needsPasswordSetup, needsLogin, blocked, authenticated
  const [authData, setAuthData] = useState(null); // stores email, userName, etc.
  const [user, setUser] = useState(null); // stores full user object after authentication
  const [showSessionExpired, setShowSessionExpired] = useState(false);

  const {
    showTimeoutWarning,
    remainingTime,
    handleExtendSession,
    handleTimeoutClose
  } = userSessionManager(authState === 'authenticated');

  useEffect(() => {
    checkAuthStatus();

    // Set up the session expired callback for API interceptor
    setSessionExpiredCallback(() => {
      setAuthState('needsLogin');
      setUser(null);
      setShowSessionExpired(true);
    });
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check if we have an existing session
      const sessionResponse = await fetch('/api/check-auth', {
        credentials: 'include'
      });

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        if (sessionData.authenticated) {
          // User has valid session, they're authenticated
          setUser(sessionData.user);
          setAuthState('authenticated');
          return;
        }
      }

      // No session, check what auth flow they need
      const authCheckResponse = await fetch('/api/auth/check', {
        credentials: 'include'
      });

      if (authCheckResponse.ok) {
        const authCheckData = await authCheckResponse.json();
        
        if (authCheckData.blocked) {
          setAuthState('blocked');
          setAuthData(authCheckData);
        } else if (authCheckData.needsRegistration) {
          setAuthState('needsRegistration');
          setAuthData(authCheckData);
        } else if (authCheckData.needsPasswordSetup) {
          setAuthState('needsPasswordSetup');
          setAuthData(authCheckData);
        } else if (authCheckData.needsLogin) {
          setAuthState('needsLogin');
          setAuthData(authCheckData);
        } else {
          // Shouldn't happen, but fallback
          setAuthState('needsLogin');
        }
      } else {
        // API error, show login as fallback
        setAuthState('needsLogin');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthState('needsLogin');
    }
  };

  const handleSessionExpiredClose = () => {
    setShowSessionExpired(false);
  };

  // Show loading state while checking auth
  if (authState === 'checking') {
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

  // Show blocked message
  if (authState === 'blocked') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        padding: '20px'
      }}>
        <h1 style={{ color: '#dc3545', marginBottom: '20px' }}>Access Blocked</h1>
        <p style={{ fontSize: '18px', color: '#666', textAlign: 'center' }}>
          Your account has been blocked. Please contact an administrator for assistance.
        </p>
      </div>
    );
  }

  // Show auth flows
  if (authState === 'needsRegistration') {
    return (
      <Router>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/register" replace />} />
        </Routes>
      </Router>
    );
  }

  if (authState === 'needsPasswordSetup') {
    return (
      <Router>
        <Routes>
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="*" element={<Navigate to="/set-password" replace />} />
        </Routes>
      </Router>
    );
  }

  if (authState === 'needsLogin') {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  // User is authenticated, show main app
  return (
    <>
      <Router>
        <Routes>
          <Route
            path="/overview"
            element={
              <Layout user={user}>
                <Overview />
              </Layout>
            }
          />
          <Route
            path="/animal"
            element={
              <Layout user={user}>
                <AnimalFolder />
              </Layout>
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
              <Layout user={user}>
                <BreedingPlan />
              </Layout>
            }
          />
          <Route
            path="/herds"
            element={
              <Layout user={user}>
                <Herds />
              </Layout>
            }
          />
          <Route
            path="/fieldsheets"
            element={
              <Layout user={user}>
                <Fieldsheets />
              </Layout>
            }
          />
          <Route
            path="/user-management"
            element={
              user?.permissions?.includes('admin') ? (
                <Layout user={user}>
                  <UserManagement />
                </Layout>
              ) : (
                <Navigate to="/animal" replace />
              )
            }
          />
          <Route
            path="/dev-console"
            element={
              user?.permissions?.includes('dev') ? (
                <Layout user={user}>
                  <DevMenu />
                </Layout>
              ) : (
                <Navigate to="/animal" replace />
              )
            }
          />
          <Route path="/" element={<Navigate to="/animal" replace />} />
          <Route path="*" element={<Navigate to="/animal" replace />} />
        </Routes>
      </Router>

      {/* Session Management Popup */}
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