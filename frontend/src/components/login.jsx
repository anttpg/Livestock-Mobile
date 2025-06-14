import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Redirect to main app
        window.location.href = '/';
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
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
      marginTop: '20px',
      padding: '15px',
      backgroundColor: '#d1ecf1',
      color: '#0c5460',
      borderRadius: '4px',
      fontSize: '14px',
      lineHeight: '1.5'
    }
  };

  return (
    <div style={styles.container}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h1 style={styles.title}>Cow Management System</h1>
        
        {error && (
          <div style={styles.error}>{error}</div>
        )}

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
            autoComplete="current-password"
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
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <div style={styles.info}>
          <strong>Demo Credentials:</strong><br />
          Username: testUser<br />
          Password: testPass
        </div>
      </form>
    </div>
  );
}

export default Login;