const path = require('path');

// Path to npm-cli.js to avoid Windows npm.cmd issue
const npmPath = path.join(
  process.env.APPDATA,
  'npm/node_modules/npm/bin/npm-cli.js'
);

module.exports = {
  apps: [
    {
      name: 'backend-dev',
      script: npmPath,
      args: 'run backend',
      cwd: './',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'frontend-dev',
      script: npmPath,
      args: 'run frontend',
      cwd: './',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
};