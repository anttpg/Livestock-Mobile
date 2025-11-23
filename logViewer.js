const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PORT = 7080;
const LOCAL_PATH = process.env.LOCAL_PATH?.replace(/['"]/g, '');

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    // Serve HTML page
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Application Logs</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Courier New', monospace; 
            background: #1e1e1e; 
            color: #d4d4d4;
            padding: 20px;
        }
        h1 { 
            color: #4ec9b0; 
            margin-bottom: 20px;
            text-align: center;
        }
        .container { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 20px; 
            max-width: 1800px;
            margin: 0 auto;
        }
        .log-section { 
            background: #252526; 
            border: 1px solid #3e3e42; 
            border-radius: 8px;
            overflow: hidden;
        }
        .log-header { 
            background: #2d2d30; 
            padding: 10px 15px; 
            border-bottom: 1px solid #3e3e42;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .log-title { 
            color: #4ec9b0; 
            font-weight: bold;
        }
        .last-updated {
            color: #858585;
            font-size: 12px;
        }
        .log-content { 
            padding: 15px; 
            height: calc(100vh - 200px);
            overflow-y: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 13px;
            line-height: 1.4;
        }
        .log-content::-webkit-scrollbar { width: 10px; }
        .log-content::-webkit-scrollbar-track { background: #1e1e1e; }
        .log-content::-webkit-scrollbar-thumb { background: #3e3e42; border-radius: 5px; }
        .log-content::-webkit-scrollbar-thumb:hover { background: #4e4e52; }
        .error { color: #f48771; }
        .warning { color: #dcdcaa; }
        .info { color: #4fc1ff; }
        @media (max-width: 1200px) {
            .container { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <h1>Application Logs</h1>
    <div class="container">
        <div class="log-section">
            <div class="log-header">
                <span class="log-title">Backend (Port 3000)</span>
                <span class="last-updated" id="backend-time"></span>
            </div>
            <div class="log-content" id="backend-log">Loading...</div>
        </div>
        <div class="log-section">
            <div class="log-header">
                <span class="log-title">Frontend (Port 8080)</span>
                <span class="last-updated" id="frontend-time"></span>
            </div>
            <div class="log-content" id="frontend-log">Loading...</div>
        </div>
    </div>
    <script>
        function highlightErrors(text) {
            return text
                .replace(/(error|failed|exception)/gi, '<span class="error">$1</span>')
                .replace(/(warning|warn)/gi, '<span class="warning">$1</span>')
                .replace(/(info|success|listening)/gi, '<span class="info">$1</span>');
        }

        async function fetchLogs() {
            try {
                const response = await fetch('/logs');
                const data = await response.json();
                
                const backendLog = document.getElementById('backend-log');
                const frontendLog = document.getElementById('frontend-log');
                
                backendLog.innerHTML = highlightErrors(data.backend || 'No logs yet...');
                frontendLog.innerHTML = highlightErrors(data.frontend || 'No logs yet...');
                
                document.getElementById('backend-time').textContent = new Date().toLocaleTimeString();
                document.getElementById('frontend-time').textContent = new Date().toLocaleTimeString();
                
                // Auto-scroll to bottom
                backendLog.scrollTop = backendLog.scrollHeight;
                frontendLog.scrollTop = frontendLog.scrollHeight;
            } catch (error) {
                console.error('Error fetching logs:', error);
            }
        }

        // Fetch logs every 2 seconds
        fetchLogs();
        setInterval(fetchLogs, 2000);
    </script>
</body>
</html>
    `);
  } else if (req.url === '/logs') {
    // Serve log data as JSON
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    const backendLog = path.join(LOCAL_PATH, 'backend.log');
    const frontendLog = path.join(LOCAL_PATH, 'frontend.log');
    
    const backend = fs.existsSync(backendLog) ? fs.readFileSync(backendLog, 'utf8') : '';
    const frontend = fs.existsSync(frontendLog) ? fs.readFileSync(frontendLog, 'utf8') : '';
    
    res.end(JSON.stringify({ backend, frontend }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Log viewer running at http://localhost:${PORT}`);
});