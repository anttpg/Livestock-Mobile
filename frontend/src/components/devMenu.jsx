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
  const [sqlBacking, setSqlBacking] = useState(false);
  const sqlOutputRef = useRef(null);

  // Network tab state
  const [networkTesting, setNetworkTesting] = useState(false);
  const [networkStats, setNetworkStats] = useState(null);
  const [networkHistory, setNetworkHistory] = useState([]);
  const [networkPhase, setNetworkPhase] = useState('');
  const [networkProgress, setNetworkProgress] = useState(0);

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
        let styleArr = [];
        if (currentColor) styleArr.push(`color: ${currentColor}`);
        if (isBold) styleArr.push('font-weight: bold');
        if (isDim) styleArr.push('opacity: 0.6');
        
        if (styleArr.length > 0) {
          html += `<span style="${styleArr.join('; ')}">${part}</span>`;
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

  const downloadLog = (type) => {
    const content = type === 'backend' ? backendLogs : frontendLogs;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${type}_log_${timestamp}.txt`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  const disconnectSql = async () => {
    try {
      const response = await fetch('/api/dev/sql/disconnect', {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        setSqlConnected(false);
        setSqlTestResult(null);
        setSqlOutput('');
        setSqlUsername('');
        setSqlPassword('');
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
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

  const backupDatabase = async () => {
    setSqlBacking(true);
    const timestamp = new Date().toLocaleTimeString();
    
    try {
      const response = await fetch('/api/dev/sql/backup', {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        setSqlOutput(prev => prev + `[${timestamp}] Database backed up successfully!\n` +
          `File: ${data.backupFileName}\n` +
          `Location: ${data.backupPath}\n\n`);
      } else {
        setSqlOutput(prev => prev + `[${timestamp}] Backup failed: ${data.message}\n\n`);
      }
    } catch (error) {
      setSqlOutput(prev => prev + `[${timestamp}] Backup error: ${error.message}\n\n`);
    } finally {
      setSqlBacking(false);
    }
  };

  const backupAndDownload = async () => {
    setSqlBacking(true);
    const timestamp = new Date().toLocaleTimeString();
    
    try {
      const response = await fetch('/api/dev/sql/download', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const contentDisposition = response.headers.get('Content-Disposition');
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
        const filename = filenameMatch ? filenameMatch[1] : `sql_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setSqlOutput(prev => prev + `[${timestamp}] Database backed up and downloaded: ${filename}\n\n`);
      } else {
        const data = await response.json();
        setSqlOutput(prev => prev + `[${timestamp}] Backup failed: ${data.message}\n\n`);
      }
    } catch (error) {
      setSqlOutput(prev => prev + `[${timestamp}] Backup error: ${error.message}\n\n`);
    } finally {
      setSqlBacking(false);
    }
  };

  // ─── Network Test ───────────────────────────────────────────────────────────

  const runNetworkTest = async () => {
    setNetworkTesting(true);
    setNetworkStats(null);
    setNetworkProgress(0);

    const results = {
      timestamp: new Date().toLocaleTimeString(),
      latency: null,
      jitter: null,
      download: null,
      upload: null,
      ttfb: null,
      connectionType: navigator.connection?.effectiveType || null,
      downlink: navigator.connection?.downlink || null,
      rtt: navigator.connection?.rtt || null,
    };

    // 1. Latency + jitter: 5 pings
    try {
      setNetworkPhase('Measuring latency...');
      setNetworkProgress(10);
      const pings = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        await fetch('/api/dev/network/ping', { credentials: 'include', cache: 'no-store' });
        pings.push(performance.now() - t0);
      }
      results.latency = Math.round(pings.reduce((a, b) => a + b) / pings.length);
      const mean = results.latency;
      results.jitter = Math.round(
        Math.sqrt(pings.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pings.length)
      );
    } catch {
      results.latency = null;
    }

    // 2. TTFB
    try {
      setNetworkPhase('Measuring time to first byte...');
      setNetworkProgress(30);
      const t0 = performance.now();
      const res = await fetch('/api/dev/network/ping', { credentials: 'include', cache: 'no-store' });
      results.ttfb = Math.round(performance.now() - t0);
      await res.json();
    } catch {
      results.ttfb = null;
    }

    // 3. Download speed — fetch 5MB chunk
    try {
      setNetworkPhase('Testing download speed (5 MB)...');
      setNetworkProgress(50);
      const DOWNLOAD_BYTES = 5 * 1024 * 1024;
      const t0 = performance.now();
      const res = await fetch(`/api/dev/network/download-test?size=${DOWNLOAD_BYTES}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      await res.arrayBuffer();
      const elapsed = (performance.now() - t0) / 1000;
      results.download = parseFloat((DOWNLOAD_BYTES / elapsed / (1024 * 1024)).toFixed(2));
    } catch {
      results.download = null;
    }

    // 4. Upload speed — send 2MB
    try {
      setNetworkPhase('Testing upload speed (2 MB)...');
      setNetworkProgress(80);
      const UPLOAD_BYTES = 2 * 1024 * 1024;
      const payload = new Uint8Array(UPLOAD_BYTES);
      const t0 = performance.now();
      await fetch('/api/dev/network/upload-test', {
        method: 'POST',
        credentials: 'include',
        body: payload,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
      const elapsed = (performance.now() - t0) / 1000;
      results.upload = parseFloat((UPLOAD_BYTES / elapsed / (1024 * 1024)).toFixed(2));
    } catch {
      results.upload = null;
    }

    setNetworkProgress(100);
    setNetworkPhase('');
    setNetworkStats(results);
    setNetworkHistory(prev => [results, ...prev].slice(0, 8));
    setNetworkTesting(false);
  };

  const getLatencyColor = (ms) => {
    if (ms === null) return '#666';
    if (ms < 20) return '#0dbc79';
    if (ms < 80) return '#e5e510';
    return '#f14c4c';
  };

  const getSpeedColor = (mbps) => {
    if (mbps === null) return '#666';
    if (mbps >= 10) return '#0dbc79';
    if (mbps >= 2) return '#e5e510';
    return '#f14c4c';
  };

  const formatSpeed = (mbps) => {
    if (mbps === null) return '—';
    if (mbps >= 100) return `${Math.round(mbps)} MB/s`;
    return `${mbps} MB/s`;
  };

  // ─── Styles ─────────────────────────────────────────────────────────────────

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
    downloadButton: {
      backgroundColor: '#17a2b8',
      color: 'white'
    },
    warningButton: {
      backgroundColor: '#ffc107',
      color: '#000'
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
    },
    sqlHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '10px',
      padding: '10px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      border: '1px solid #dee2e6'
    },
    sqlHeaderInfo: {
      fontSize: '14px',
      color: '#666'
    },
    sqlActions: {
      display: 'flex',
      gap: '10px'
    },
    // Network tab styles
    networkContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    },
    networkToolbar: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '14px 16px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #dee2e6'
    },
    networkPhaseText: {
      fontSize: '13px',
      color: '#666',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      flex: 1
    },
    progressBar: {
      height: '4px',
      backgroundColor: '#dee2e6',
      borderRadius: '2px',
      overflow: 'hidden',
      width: '160px'
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#007bff',
      borderRadius: '2px',
      transition: 'width 0.3s ease'
    },
    statGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '16px'
    },
    statCard: {
      backgroundColor: '#1e1e1e',
      borderRadius: '8px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.15)'
    },
    statLabel: {
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#888',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace'
    },
    statValue: {
      fontSize: '28px',
      fontWeight: '700',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      lineHeight: 1
    },
    statUnit: {
      fontSize: '12px',
      color: '#888',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace'
    },
    infoGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '16px'
    },
    infoCard: {
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      padding: '16px',
      border: '1px solid #dee2e6'
    },
    infoLabel: {
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: '#999',
      marginBottom: '6px'
    },
    infoValue: {
      fontSize: '15px',
      fontWeight: '600',
      color: '#333',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace'
    },
    historyTable: {
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: '13px'
    },
    historyTh: {
      textAlign: 'left',
      padding: '8px 12px',
      backgroundColor: '#1e1e1e',
      color: '#888',
      fontWeight: '600',
      fontSize: '11px',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      borderBottom: '1px solid #333'
    },
    historyTd: {
      padding: '8px 12px',
      borderBottom: '1px solid #f0f0f0',
      color: '#333'
    },
    historyTr: {
      transition: 'background 0.1s'
    },
    sectionTitle: {
      fontSize: '13px',
      fontWeight: '600',
      color: '#555',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: '10px'
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: '#aaa',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: '14px'
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
            <>
              <button
                style={{ ...styles.button, ...styles.downloadButton }}
                onClick={() => downloadLog(activeTab)}
              >
                Download Log
              </button>
              <button
                style={{ ...styles.button, ...styles.clearButton }}
                onClick={() => clearLog(activeTab)}
              >
                Clear Log
              </button>
            </>
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
        {['backend', 'frontend', 'console', 'sql', 'network'].map(tab => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'backend' ? 'Backend Logs'
              : tab === 'frontend' ? 'Frontend Logs'
              : tab === 'console' ? 'Console'
              : tab === 'sql' ? 'SQL Console'
              : 'Network'}
          </button>
        ))}
      </div>

      {/* ── Log tabs ── */}
      {(activeTab === 'backend' || activeTab === 'frontend') && (
        <div
          ref={activeTab === 'backend' ? backendLogRef : frontendLogRef}
          style={styles.logContainer}
          dangerouslySetInnerHTML={{
            __html: ansiToHtml(activeTab === 'backend' ? backendLogs : frontendLogs)
          }}
        />
      )}

      {/* ── Console tab ── */}
      {activeTab === 'console' && (
        <>
          <div ref={consoleLogRef} style={styles.logContainer}>
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

      {/* ── SQL tab ── */}
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
                <div style={{ ...styles.resultBox, ...styles.errorResult }}>
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
              <div style={styles.sqlHeader}>
                <div style={styles.sqlHeaderInfo}>
                  Connected as <strong>{sqlUsername}</strong>
                </div>
                <div style={styles.sqlActions}>
                  <button
                    style={{ ...styles.button, ...styles.sqlButton }}
                    onClick={backupDatabase}
                    disabled={sqlBacking}
                  >
                    {sqlBacking ? 'Backing up...' : 'Backup Database'}
                  </button>
                  <button
                    style={{ ...styles.button, ...styles.downloadButton }}
                    onClick={backupAndDownload}
                    disabled={sqlBacking}
                  >
                    {sqlBacking ? 'Backing up...' : 'Backup & Download'}
                  </button>
                  <button
                    style={{ ...styles.button, ...styles.warningButton }}
                    onClick={disconnectSql}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
              
              <div ref={sqlOutputRef} style={styles.logContainer}>
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

      {/* ── Network tab ── */}
      {activeTab === 'network' && (
        <div style={styles.networkContainer}>

          {/* Toolbar */}
          <div style={styles.networkToolbar}>
            <button
              style={{
                ...styles.button,
                ...styles.sqlButton,
                opacity: networkTesting ? 0.6 : 1,
                cursor: networkTesting ? 'not-allowed' : 'pointer',
                minWidth: '120px'
              }}
              onClick={runNetworkTest}
              disabled={networkTesting}
            >
              {networkTesting ? 'Testing...' : 'Run Test'}
            </button>
            {networkTesting && (
              <>
                <span style={styles.networkPhaseText}>{networkPhase}</span>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${networkProgress}%` }} />
                </div>
              </>
            )}
            {!networkTesting && networkStats && (
              <span style={{ ...styles.networkPhaseText, color: '#0dbc79' }}>
                Last test: {networkStats.timestamp}
              </span>
            )}
          </div>

          {/* Main stat cards */}
          {networkStats ? (
            <>
              <div style={styles.statGrid}>
                <div style={styles.statCard}>
                  <span style={styles.statLabel}>Latency</span>
                  <span style={{ ...styles.statValue, color: getLatencyColor(networkStats.latency) }}>
                    {networkStats.latency !== null ? networkStats.latency : '—'}
                  </span>
                  <span style={styles.statUnit}>ms (avg of 5 pings)</span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.statLabel}>Jitter</span>
                  <span style={{ ...styles.statValue, color: getLatencyColor(networkStats.jitter) }}>
                    {networkStats.jitter !== null ? networkStats.jitter : '—'}
                  </span>
                  <span style={styles.statUnit}>ms std deviation</span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.statLabel}>Download</span>
                  <span style={{ ...styles.statValue, color: getSpeedColor(networkStats.download) }}>
                    {networkStats.download !== null ? networkStats.download : '—'}
                  </span>
                  <span style={styles.statUnit}>MB/s (5 MB sample)</span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.statLabel}>Upload</span>
                  <span style={{ ...styles.statValue, color: getSpeedColor(networkStats.upload) }}>
                    {networkStats.upload !== null ? networkStats.upload : '—'}
                  </span>
                  <span style={styles.statUnit}>MB/s (2 MB sample)</span>
                </div>
              </div>

              {/* Secondary info */}
              <div>
                <div style={styles.sectionTitle}>Connection Details</div>
                <div style={styles.infoGrid}>
                  <div style={styles.infoCard}>
                    <div style={styles.infoLabel}>Time to First Byte</div>
                    <div style={{ ...styles.infoValue, color: getLatencyColor(networkStats.ttfb) }}>
                      {networkStats.ttfb !== null ? `${networkStats.ttfb} ms` : '—'}
                    </div>
                  </div>
                  <div style={styles.infoCard}>
                    <div style={styles.infoLabel}>Connection Type</div>
                    <div style={styles.infoValue}>
                      {networkStats.connectionType || 'Not reported'}
                    </div>
                  </div>
                  <div style={styles.infoCard}>
                    <div style={styles.infoLabel}>Browser-reported RTT</div>
                    <div style={styles.infoValue}>
                      {networkStats.rtt !== null ? `${networkStats.rtt} ms` : 'Not reported'}
                    </div>
                  </div>
                  <div style={styles.infoCard}>
                    <div style={styles.infoLabel}>Browser-reported Downlink</div>
                    <div style={styles.infoValue}>
                      {networkStats.downlink !== null ? `${networkStats.downlink} Mbps` : 'Not reported'}
                    </div>
                  </div>
                  <div style={styles.infoCard}>
                    <div style={styles.infoLabel}>User Agent</div>
                    <div style={{ ...styles.infoValue, fontSize: '11px', wordBreak: 'break-all' }}>
                      {navigator.userAgent}
                    </div>
                  </div>
                  <div style={styles.infoCard}>
                    <div style={styles.infoLabel}>Online Status</div>
                    <div style={{
                      ...styles.infoValue,
                      color: navigator.onLine ? '#0dbc79' : '#f14c4c'
                    }}>
                      {navigator.onLine ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            !networkTesting && (
              <div style={styles.emptyState}>
                Press "Run Test" to measure latency, download speed, and upload speed.
              </div>
            )
          )}

          {/* History table */}
          {networkHistory.length > 0 && (
            <div>
              <div style={styles.sectionTitle}>Test History</div>
              <div style={{
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #dee2e6'
              }}>
                <table style={styles.historyTable}>
                  <thead>
                    <tr>
                      {['Time', 'Latency', 'Jitter', 'TTFB', 'Download', 'Upload'].map(h => (
                        <th key={h} style={styles.historyTh}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {networkHistory.map((row, i) => (
                      <tr key={i} style={{
                        backgroundColor: i === 0 ? '#f0f7ff' : (i % 2 === 0 ? '#fafafa' : 'white')
                      }}>
                        <td style={styles.historyTd}>{row.timestamp}</td>
                        <td style={{ ...styles.historyTd, color: getLatencyColor(row.latency), fontWeight: 600 }}>
                          {row.latency !== null ? `${row.latency} ms` : '—'}
                        </td>
                        <td style={{ ...styles.historyTd, color: getLatencyColor(row.jitter) }}>
                          {row.jitter !== null ? `${row.jitter} ms` : '—'}
                        </td>
                        <td style={{ ...styles.historyTd, color: getLatencyColor(row.ttfb) }}>
                          {row.ttfb !== null ? `${row.ttfb} ms` : '—'}
                        </td>
                        <td style={{ ...styles.historyTd, color: getSpeedColor(row.download), fontWeight: 600 }}>
                          {formatSpeed(row.download)}
                        </td>
                        <td style={{ ...styles.historyTd, color: getSpeedColor(row.upload), fontWeight: 600 }}>
                          {formatSpeed(row.upload)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default DevMenu;