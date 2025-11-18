import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function SetPassword() {
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingInfo, setFetchingInfo] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Get authenticated email from Cloudflare
    const fetchInfo = async () => {
      try {
        const response = await fetch('/api/auth/check', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.needsPasswordSetup) {
            setEmail(data.email);
            setUserName(data.userName);
          } else {
            // User doesn't need password setup, redirect appropriately
            window.location.href = '/';
          }
        }
      } catch (error) {
        console.error('Error fetching info:', error);
        setError('Unable to verify authentication');
      } finally {
        setFetchingInfo(false);
      }
    };

    fetchInfo();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Password set successfully, redirect to main app
        window.location.href = '/';
      } else {
        setError(data.message || 'Failed to set password');
      }
    } catch (error) {
      console.error('Set password error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f4f4f4'
    },
    form: {
      backgroundColor: 'white',
      padding: '40px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      width: '100%',
      maxWidth: '400px'
    },
    title: {
      textAlign: 'center',
      marginBottom: '30px',
      color: '#333'
    },
    inputGroup: {
      marginBottom: '20px'
    },
    label: {
      display: 'block',
      marginBottom: '5px',
      color: '#555',
      fontWeight: '500'
    },
    input: {
      width: '100%',
      padding: '10px',
      border: '2px solid #ddd',
      borderRadius: '4px',
      fontSize: '16px',
      transition: 'border-color 0.3s',
      boxSizing: 'border-box'
    },
    button: {
      width: '100%',
      padding: '12px',
      backgroundColor: '#28a745',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.3s'
    },
    buttonDisabled: {
      backgroundColor: '#ccc',
      cursor: 'not-allowed'
    },
    error: {
      backgroundColor: '#f8d7da',
      color: '#721c24',
      padding: '10px',
      borderRadius: '4px',
      marginBottom: '20px',
      textAlign: 'center'
    },
    info: {
      marginTop: '0',
      marginBottom: '20px',
      padding: '15px',
      backgroundColor: '#fff3cd',
      color: '#856404',
      borderRadius: '4px',
      fontSize: '14px',
      lineHeight: '1.5'
    }
  };

  if (fetchingInfo) {
    return (
      <div style={styles.container}>
        <div style={styles.form}>
          <h1 style={styles.title}>Cattle Management System</h1>
          <p style={{ textAlign: 'center', color: '#666' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h1 style={styles.title}>Set Your Password</h1>
        
        <div style={styles.info}>
          <strong>Welcome, {userName}!</strong><br />
          Your password has been reset. Please create a new password to continue.
        </div>

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="password">New Password:</label>
          <input
            style={styles.input}
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            autoComplete="new-password"
            minLength={6}
            maxLength={100}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="confirmPassword">Confirm Password:</label>
          <input
            style={styles.input}
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            autoComplete="new-password"
            minLength={6}
            maxLength={100}
          />
        </div>

        <button
          style={{
            ...styles.button,
            ...(loading ? styles.buttonDisabled : {})
          }}
          type="submit"
          disabled={loading}
        >
          {loading ? 'Setting Password...' : 'Set Password'}
        </button>
      </form>
    </div>
  );
}

export default SetPassword;