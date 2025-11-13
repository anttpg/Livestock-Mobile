import React, { useState, useEffect } from 'react';
import Popup from './popup';

function TimeoutPopup({ 
  isOpen, 
  onClose, 
  onExtend,
  initialCountdown = 60 
}) {
  const [countdown, setCountdown] = useState(initialCountdown);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (isOpen && !isExpired) {
      setCountdown(initialCountdown);
      setIsExpired(false);
      
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isOpen, initialCountdown, isExpired]);

  const handleExtendSession = async () => {
    try {
      const response = await fetch('/api/extend-session', {
        credentials: 'include'
      });
      
      if (response.ok) {
        onExtend();
        onClose();
      } else {
        // Session is already expired, redirect to login
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error extending session:', error);
      window.location.href = '/login';
    }
  };

  const handleClose = () => {
    if (!isExpired) {
      // Closing the popup before expiration counts as extending session
      handleExtendSession();
    } else {
      // If expired, just redirect to login
      onClose();
      window.location.href = '/login';
    }
  };

  const handleLoginRedirect = () => {
    onClose();
    window.location.href = '/login';
  };

  // Expired state
  if (isExpired) {
    return (
      <Popup
        isOpen={isOpen}
        onClose={handleLoginRedirect}
        title="Session Expired"
        width="400px"
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '20px' }}>
            <p>Your session has timed out for security reasons.</p>
            <p>Please log in again to continue.</p>
          </div>
          
          <button
            onClick={handleLoginRedirect}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Go to Login
          </button>
        </div>
      </Popup>
    );
  }

  // Warning state
  return (
    <Popup
      isOpen={isOpen}
      onClose={handleClose}
      title="Session Expiring Soon"
      width="450px"
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '20px' }}>
          <p>Your session will expire in:</p>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: countdown <= 10 ? '#dc3545' : '#ffc107',
            margin: '10px 0' 
          }}>
            {countdown} second{countdown !== 1 ? 's' : ''}
          </div>
          <p>Would you like to extend your session?</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={handleExtendSession}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Extend Session
          </button>
          <button
            onClick={handleLoginRedirect}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Logout Now
          </button>
        </div>
      </div>
    </Popup>
  );
}

export default TimeoutPopup;