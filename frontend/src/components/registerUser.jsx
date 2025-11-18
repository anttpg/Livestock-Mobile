import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function RegisterUser() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingEmail, setFetchingEmail] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Get authenticated email from Cloudflare
    const fetchEmail = async () => {
      try {
        const response = await fetch('/api/auth/email', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setEmail(data.email);
        }
      } catch (error) {
        console.error('Error fetching email:', error);
        setError('Unable to verify authentication');
      } finally {
        setFetchingEmail(false);
      }
    };

    fetchEmail();
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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Registration successful, redirect to main app
        if (data.isFirstUser) {
          alert('Welcome! As the first user, you have been granted admin privileges.');
        }
        window.location.href = '/';
      } else {
        setError(data.message || 'Registration failed');
        if (data.details) {
          console.error('Validation errors:', data.details); // ADD THIS
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
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
    inputDisabled: {
      backgroundColor: '#f0f0f0',
      cursor: 'not-allowed'
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
      marginTop: '20px',
      padding: '15px',
      backgroundColor: '#d1ecf1',
      color: '#0c5460',
      borderRadius: '4px',
      fontSize: '14px',
      lineHeight: '1.5'
    }
  };

  if (fetchingEmail) {
    return (
      <div style={styles.container}>
        <div style={styles.form}>
          <h1 style={styles.title}>Cattle Management System</h1>
          <p style={{ textAlign: 'center', color: '#666' }}>Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h1 style={styles.title}>Create Account</h1>
        
        {error && (
          <div style={styles.error}>{error}</div>
        )}

        <div style={styles.info}>
          You are authenticated as: <strong>{email}</strong>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="username">Username:</label>
          <input
            style={styles.input}
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={loading}
            autoComplete="username"
            minLength={3}
            maxLength={50}
            pattern="[\w\-]+"
            title="Username must contain only letters, numbers, underscores, and hyphens"
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="email">Email:</label>
          <input
            style={{...styles.input, ...styles.inputDisabled}}
            type="email"
            id="email"
            value={email}
            disabled
            autoComplete="email"
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="password">Password:</label>
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
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}

export default RegisterUser;