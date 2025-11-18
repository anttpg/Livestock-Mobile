import React, { useState, useEffect, useRef } from 'react';

function DevMenu() {
  const [activeTab, setActiveTab] = useState('backend');
  const [backendLogs, setBackendLogs] = useState('Loading...');
  const [frontendLogs, setFrontendLogs] = useState('Loading...');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const backendLogRef = useRef(null);
  const frontendLogRef = useRef(null);

  // SQL Test state
  const [showSqlTest, setShowSqlTest] = useState(false);
  const [sqlUsername, setSqlUsername] = useState('');
  const [sqlPassword, setSqlPassword] = useState('');
  const [sqlTestResult, setSqlTestResult] = useState(null);
  const [sqlTesting, setSqlTesting] = useState(false);

  useEffect(() => {
    fetchLogs();

    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  useEffect(() => {
    if (activeTab === 'backend' && backendLogRef.current) {
      backendLogRef.current.scrollTop = backendLogRef.current.scrollHeight;
    }
  }, [backendLogs, activeTab]);

  useEffect(() => {
    if (activeTab === 'frontend' && frontendLogRef.current) {
      frontendLogRef.current.scrollTop = frontendLogRef.current.scrollHeight;
    }
  }, [frontendLogs, activeTab]);

  const ansiToHtml = (text) => {
    const ansiColors = {
      '30': '#000000', '31': '#cd3131', '32': '#0dbc79', '33': '#e5e510',
      '34': '#2472c8', '35': '#bc3fbc', '36': '#11a8cd', '37': '#e5e5e5',
      '90': '#666666', '91': '#f14c4c', '92': '#23d18b', '93': '#f5f543',
      '94': '#3b8eea', '95': '#d670d6', '96': '#29b8db', '97': '#ffffff',
    };

    let html = text;
    let styles = [];

    html = html.replace(/\x1b\[([0-9;]+)m/g, (match, codes) => {
      const codeList = codes.split(';');
      let openTags = '';
      
      codeList.forEach(code => {
        if (code === '0') {
          if (styles.length > 0) {
            openTags = '</span>'.repeat(styles.length);
            styles = [];
          }
        } else if (code === '1') {
          styles.push('bold');
          openTags += '<span style="font-weight: bold;">';
        } else if (code === '22') {
          // Normal intensity
        } else if (code === '2') {
          styles.push('dim');
          openTags += '<span style="opacity: 0.6;">';
        } else if (ansiColors[code]) {
          styles.push('color');
          openTags += `<span style="color: ${ansiColors[code]};">`;
        }
      });
      
      return openTags;
    });

    html += '</span>'.repeat(styles.length);
    return html;
  };

  const fetchLogs = async () => {
    try {
      const backendRes = await fetch('/api/dev/logs/backend', {
        credentials: 'include'
      });
      if (backendRes.ok) {
        const data = await backendRes.json();
        setBackendLogs(data.content || 'No logs available');
      }

      const frontendRes = await fetch('/api/dev/logs/frontend', {
        credentials: 'include'
      });
      if (frontendRes.ok) {
        const data = await frontendRes.json();
        setFrontendLogs(data.content || 'No logs available');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const clearLog = async (type) => {
    try {
      const response = await fetch(`/api/dev/logs/${type}/clear`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        if (type === 'backend') {
          setBackendLogs('Log cleared');
        } else {
          setFrontendLogs('Log cleared');
        }
        setTimeout(fetchLogs, 500);
      }
    } catch (error) {
      console.error('Error clearing log:', error);
    }
  };

  const testSqlConnection = async (e) => {
    e.preventDefault();
    setSqlTesting(true);
    setSqlTestResult(null);

    try {
      const response = await fetch('/api/dev/test-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: sqlUsername,
          password: sqlPassword
        })
      });

      const data = await response.json();
      setSqlTestResult(data);
    } catch (error) {
      console.error('Error testing SQL connection:', error);
      setSqlTestResult({
        success: false,
        message: 'Network error'
      });
    } finally {
      setSqlTesting(false);
    }
  };

  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
    },
    title: {
      margin: 0,
      color: '#333'
    },
    controls: {
      display: 'flex',
      gap: '10px',
      alignItems: 'center'
    },
    checkbox: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      color: '#333'
    },
    tabs: {
      display: 'flex',
      gap: '10px',
      marginBottom: '20px',
      borderBottom: '2px solid #dee2e6'
    },
    tab: {
      padding: '10px 20px',
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: '500',
      borderBottom: '3px solid transparent',
      transition: 'all 0.2s',
      color: '#666'  // Changed from white to gray
    },
    activeTab: {
      borderBottom: '3px solid #007bff',
      color: '#007bff'
    },
    logContainer: {
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      padding: '20px',
      borderRadius: '8px',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: '13px',
      lineHeight: '1.5',
      height: '70vh',
      overflowY: 'auto',
      overflowX: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      position: 'relative',  // Added
      // Remove any gradients or pseudo-elements that might be causing darkening
    },
    button: {
      padding: '8px 16px',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'background-color 0.2s'
    },
    clearButton: {
      backgroundColor: '#dc3545',
      color: 'white'
    },
    refreshButton: {
      backgroundColor: '#28a745',
      color: 'white'
    },
    sqlButton: {
      backgroundColor: '#007bff',
      color: 'white'
    },
    info: {
      backgroundColor: '#d1ecf1',
      color: '#0c5460',
      padding: '15px',
      borderRadius: '4px',
      marginBottom: '20px'
    },
    sqlTestContainer: {
      backgroundColor: '#f8f9fa',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
      border: '1px solid #dee2e6'
    },
    sqlForm: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '400px'
    },
    input: {
      padding: '8px',
      border: '1px solid #ced4da',
      borderRadius: '4px',
      fontSize: '14px'
    },
    resultBox: {
      marginTop: '10px',
      padding: '10px',
      borderRadius: '4px',
      fontSize: '14px'
    },
    successResult: {
      backgroundColor: '#d4edda',
      color: '#155724',
      border: '1px solid #c3e6cb'
    },
    errorResult: {
      backgroundColor: '#f8d7da',
      color: '#721c24',
      border: '1px solid #f5c6cb'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Developer Console</h1>
        <div style={styles.controls}>
          <button
            style={{ ...styles.button, ...styles.sqlButton }}
            onClick={() => setShowSqlTest(!showSqlTest)}
          >
            {showSqlTest ? 'Hide' : 'Show'} SQL Test
          </button>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (2s)
          </label>
          <button
            style={{ ...styles.button, ...styles.refreshButton }}
            onClick={fetchLogs}
          >
            Refresh Now
          </button>
          <button
            style={{ ...styles.button, ...styles.clearButton }}
            onClick={() => clearLog(activeTab)}
          >
            Clear {activeTab === 'backend' ? 'Backend' : 'Frontend'} Log
          </button>
        </div>
      </div>

      {showSqlTest && (
        <div style={styles.sqlTestContainer}>
          <h3>Test SQL Server Connection</h3>
          <form style={styles.sqlForm} onSubmit={testSqlConnection}>
            <input
              style={styles.input}
              type="text"
              placeholder="SQL Username"
              value={sqlUsername}
              onChange={(e) => setSqlUsername(e.target.value)}
              required
            />
            <input
              style={styles.input}
              type="password"
              placeholder="SQL Password"
              value={sqlPassword}
              onChange={(e) => setSqlPassword(e.target.value)}
              required
            />
            <button
              style={{ ...styles.button, ...styles.sqlButton }}
              type="submit"
              disabled={sqlTesting}
            >
              {sqlTesting ? 'Testing...' : 'Test Connection'}
            </button>
          </form>
          
          {sqlTestResult && (
            <div style={{
              ...styles.resultBox,
              ...(sqlTestResult.success ? styles.successResult : styles.errorResult)
            }}>
              <strong>{sqlTestResult.success ? 'Success!' : 'Failed'}</strong>
              <br />
              {sqlTestResult.message}
              {sqlTestResult.details && (
                <>
                  <br />
                  <small>{sqlTestResult.details}</small>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'backend' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('backend')}
        >
          Backend Logs
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'frontend' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('frontend')}
        >
          Frontend Logs
        </button>
      </div>

      <div
        ref={activeTab === 'backend' ? backendLogRef : frontendLogRef}
        style={styles.logContainer}
        dangerouslySetInnerHTML={{
          __html: ansiToHtml(activeTab === 'backend' ? backendLogs : frontendLogs)
        }}
      />
    </div>
  );
}

export default DevMenu;