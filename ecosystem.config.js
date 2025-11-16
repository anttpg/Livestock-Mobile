const path = require('path');

module.exports = {
  apps: [
    {
      name: 'backend-prod',
      script: 'backend/sessionManager.js',
      interpreter: 'node',
      cwd: './',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'frontend-prod',
      script: path.join(__dirname, 'node_modules/vite/bin/vite.js'),
      args: 'preview --port 8080 --host',
      interpreter: 'node',
      cwd: './frontend',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};