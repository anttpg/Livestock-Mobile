import React, { useState, useEffect, useRef } from 'react';

function DevMenu() {
  const [activeTab, setActiveTab] = useState('backend');
  const [backendLogs, setBackendLogs] = useState('Loading...');
  const [frontendLogs, setFrontendLogs] = useState('Loading...');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const backendLogRef = useRef(null);
  const frontendLogRef = useRef(null);
  const consoleLogRef = useRef(null);

  // Console state
  const [consoleOutput, setConsoleOutput] = useState('');
  const [consoleInput, setConsoleInput] = useState('');
  const [consoleExecuting, setConsoleExecuting] = useState(false);

  // SQL Console state
  const [sqlConnected, setSqlConnected] = useState(false);
  const [sqlUsername, setSqlUsername] = useState('');
  const [sqlPassword, setSqlPassword] = useState('');
  const [sqlTestResult, setSqlTestResult] = useState(null);
  const [sqlTesting, setSqlTesting] = useState(false);
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlOutput, setSqlOutput] = useState('');
  const [sqlExecuting, setSqlExecuting] = useState(false);
  const sqlOutputRef = useRef(null);

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

  useEffect(() => {
    if (activeTab === 'console' && consoleLogRef.current) {
      consoleLogRef.current.scrollTop = consoleLogRef.current.scrollHeight;
    }
  }, [consoleOutput, activeTab]);

  useEffect(() => {
    if (activeTab === 'sql' && sqlOutputRef.current) {
      sqlOutputRef.current.scrollTop = sqlOutputRef.current.scrollHeight;
    }
  }, [sqlOutput, activeTab]);

  const ansiToHtml = (text) => {
    const ansiColors = {
      '30': '#000000', '31': '#cd3131', '32': '#0dbc79', '33': '#e5e510',
      '34': '#2472c8', '35': '#bc3fbc', '36': '#11a8cd', '37': '#e5e5e5',
      '90': '#666666', '91': '#f14c4c', '92': '#23d18b', '93': '#f5f543',
      '94': '#3b8eea', '95': '#d670d6', '96': '#29b8db', '97': '#ffffff',
    };

    let html = '';
    let currentColor = null;
    let isBold = false;
    let isDim = false;
    
    const parts = text.split(/(\x1b\[[0-9;]+m)/g);
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.startsWith('\x1b[')) {
        const codes = part.slice(2, -1).split(';');
        
        codes.forEach(code => {
          if (code === '0') {
            currentColor = null;
            isBold = false;
            isDim = false;
          } else if (code === '1') {
            isBold = true;
          } else if (code === '22') {
            isBold = false;
            isDim = false;
          } else if (code === '2') {
            isDim = true;
          } else if (ansiColors[code]) {
            currentColor = ansiColors[code];
          }
        });
      } else if (part) {
        let styles = [];
        if (currentColor) styles.push(`color: ${currentColor}`);
        if (isBold) styles.push('font-weight: bold');
        if (isDim) styles.push('opacity: 0.6');
        
        if (styles.length > 0) {
          html += `<span style="${styles.join('; ')}">${part}</span>`;
        } else {
          html += part;
        }
      }
    }
    
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

  const executeConsoleCommand = async (e) => {
    e.preventDefault();
    if (!consoleInput.trim()) return;

    setConsoleExecuting(true);
    const timestamp = new Date().toLocaleTimeString();
    const commandLog = `[${timestamp}] $ ${consoleInput}\n`;
    
    try {
      const response = await fetch('/api/dev/console', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ command: consoleInput })
      });

      const data = await response.json();
      
      if (data.success) {
        setConsoleOutput(prev => prev + commandLog + data.output + '\n\n');
      } else {
        setConsoleOutput(prev => prev + commandLog + `ERROR: ${data.message}\n\n`);
      }
      
      setConsoleInput('');
    } catch (error) {
      setConsoleOutput(prev => prev + commandLog + `ERROR: ${error.message}\n\n`);
    } finally {
      setConsoleExecuting(false);
    }
  };

  const testSqlConnection = async (e) => {
    e.preventDefault();
    setSqlTesting(true);
    setSqlTestResult(null);

    try {
      const response = await fetch('/api/dev/sql/connect', {
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
      
      if (data.success) {
        setSqlConnected(true);
        setSqlOutput(`Connected to database successfully!\nServer: ${data.server}\nDatabase: ${data.database}\n\nReady for queries...\n\n`);
      }
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

  const executeSqlQuery = async (e) => {
    e.preventDefault();
    if (!sqlQuery.trim()) return;

    setSqlExecuting(true);
    const timestamp = new Date().toLocaleTimeString();
    const queryLog = `[${timestamp}]\n${sqlQuery}\n\n`;
    
    try {
      const response = await fetch('/api/dev/sql/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          query: sqlQuery
        })
      });

      const data = await response.json();
      
      if (data.success) {
        let output = queryLog;
        if (data.rowCount !== undefined) {
          output += `Rows affected: ${data.rowCount}\n`;
        }
        if (data.data && data.data.length > 0) {
          output += `\nResults (${data.data.length} rows):\n`;
          output += JSON.stringify(data.data, null, 2) + '\n';
        }
        output += '\n---\n\n';
        setSqlOutput(prev => prev + output);
      } else {
        setSqlOutput(prev => prev + queryLog + `ERROR: ${data.message}\n\n---\n\n`);
        
        // If connection lost, reset to login screen
        if (data.code === 'NO_CONNECTION') {
          setSqlConnected(false);
          setSqlTestResult({
            success: false,
            message: 'Connection lost. Please reconnect.'
          });
        }
      }
      
      setSqlQuery('');
    } catch (error) {
      setSqlOutput(prev => prev + queryLog + `ERROR: ${error.message}\n\n---\n\n`);
    } finally {
      setSqlExecuting(false);
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
      color: '#666'
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
      height: 'calc(100vh - 400px)',
      overflowY: 'auto',
      overflowX: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      position: 'relative'
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
    },
    consoleForm: {
      marginTop: '20px',
      display: 'flex',
      gap: '10px',
      alignItems: 'center'
    },
    consoleInput: {
      flex: 1,
      padding: '12px',
      marginBottom: '20px',
      border: '1px solid #ced4da',
      borderRadius: '4px',
      fontSize: '14px',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace'
    },
    sqlQueryInput: {
      flex: 1,
      padding: '12px',
      border: '1px solid #ced4da',
      borderRadius: '4px',
      fontSize: '14px',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      resize: 'vertical'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Developer Console</h1>
        <div style={styles.controls}>
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
          {(activeTab === 'backend' || activeTab === 'frontend') && (
            <button
              style={{ ...styles.button, ...styles.clearButton }}
              onClick={() => clearLog(activeTab)}
            >
              Clear {activeTab === 'backend' ? 'Backend' : 'Frontend'} Log
            </button>
          )}
          {activeTab === 'console' && (
            <button
              style={{ ...styles.button, ...styles.clearButton }}
              onClick={() => setConsoleOutput('')}
            >
              Clear Console
            </button>
          )}
          {activeTab === 'sql' && sqlConnected && (
            <button
              style={{ ...styles.button, ...styles.clearButton }}
              onClick={() => setSqlOutput('')}
            >
              Clear Output
            </button>
          )}
        </div>
      </div>

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
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'console' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('console')}
        >
          Console
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'sql' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('sql')}
        >
          SQL Console
        </button>
      </div>

      {(activeTab === 'backend' || activeTab === 'frontend') && (
        <div
          ref={activeTab === 'backend' ? backendLogRef : frontendLogRef}
          style={styles.logContainer}
          dangerouslySetInnerHTML={{
            __html: ansiToHtml(activeTab === 'backend' ? backendLogs : frontendLogs)
          }}
        />
      )}

      {activeTab === 'console' && (
        <>
          <div
            ref={consoleLogRef}
            style={styles.logContainer}
          >
            <pre style={{ margin: 0 }}>{consoleOutput || 'No output yet. Enter a command below...'}</pre>
          </div>
          <form onSubmit={executeConsoleCommand} style={styles.consoleForm}>
            <input
              style={styles.consoleInput}
              type="text"
              placeholder="Enter command (e.g., ls, pwd, echo 'Hello')"
              value={consoleInput}
              onChange={(e) => setConsoleInput(e.target.value)}
              disabled={consoleExecuting}
            />
            <button
              style={{ ...styles.button, ...styles.sqlButton }}
              type="submit"
              disabled={consoleExecuting}
            >
              {consoleExecuting ? 'Executing...' : 'Execute'}
            </button>
          </form>
        </>
      )}

      {activeTab === 'sql' && (
        <>
          {!sqlConnected ? (
            <div style={styles.sqlTestContainer}>
              <h3>Connect to SQL Server</h3>
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
                  {sqlTesting ? 'Connecting...' : 'Connect'}
                </button>
              </form>
              
              {sqlTestResult && !sqlTestResult.success && (
                <div style={{
                  ...styles.resultBox,
                  ...styles.errorResult
                }}>
                  <strong>Connection Failed</strong>
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
          ) : (
            <>
              <div
                ref={sqlOutputRef}
                style={styles.logContainer}
              >
                <pre style={{ margin: 0 }}>{sqlOutput}</pre>
              </div>
              <form onSubmit={executeSqlQuery} style={styles.consoleForm}>
                <textarea
                  style={styles.sqlQueryInput}
                  placeholder="Enter SQL query (e.g., SELECT * FROM TableName)"
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  disabled={sqlExecuting}
                  rows={3}
                />
                <button
                  style={{ ...styles.button, ...styles.sqlButton }}
                  type="submit"
                  disabled={sqlExecuting}
                >
                  {sqlExecuting ? 'Executing...' : 'Execute Query'}
                </button>
              </form>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default DevMenu;