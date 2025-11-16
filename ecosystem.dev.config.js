const path = require("path");
const npmPath = path.resolve(require.resolve("npm"));

module.exports = {
  apps: [
    {
      name: "backend-dev",
      script: npmPath,
      args: "run backend",
      cwd: './'
    },
    {
      name: "frontend-dev",
      script: npmPath,
      args: "run frontend",
      cwd: './'
    }
  ]
};