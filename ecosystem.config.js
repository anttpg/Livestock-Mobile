module.exports = {
    apps: [
      {
        name: 'backend',
        script: 'npm',
        args: 'run backend',
        cwd: './',
        watch: false,
        autorestart: true,
        max_restarts: 10,
        min_uptime: '10s'
      },
      {
        name: 'frontend',
        script: 'npm',
        args: 'run frontend',
        cwd: './',
        watch: false,
        autorestart: true,
        max_restarts: 10,
        min_uptime: '10s'
      }
    ]
  };