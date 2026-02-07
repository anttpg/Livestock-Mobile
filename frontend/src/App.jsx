import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { useUserSessionManager } from './userSessionManager';
import AnimalFolder from './components/animalFolder';
import { UserProvider, useUser } from './UserContext';

function AppContent() {
  const { user, authState, authData, showSessionExpired, handleSessionExpiredClose } = useUser();

  const {
    showTimeoutWarning,
    remainingTime,
    handleExtendSession,
    handleTimeoutClose
  } = useUserSessionManager(authState === 'authenticated');

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
              <Layout>
                <Overview />
              </Layout>
            }
          />
          <Route
            path="/animal"
            element={
              <Layout>
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
              <Layout>
                <BreedingPlan />
              </Layout>
            }
          />
          <Route
            path="/herds"
            element={
              <Layout>
                <Herds />
              </Layout>
            }
          />
          <Route
            path="/fieldsheets"
            element={
              <Layout>
                <Fieldsheets />
              </Layout>
            }
          />
          <Route
            path="/user-management"
            element={
              user?.permissions?.includes('admin') ? (
                <Layout>
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
                <Layout>
                  <DevMenu />
                </Layout>
              ) : (
                <Navigate to="/animal" replace />
              )
            }
          />
          <Route
            path="/playhouse"
            element={
              <div></div>
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

function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}

export default App;