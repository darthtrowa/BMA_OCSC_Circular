const path = require("path");

// Auto-detect the base directory (works regardless of where the project is placed)
const baseDir = path.resolve(__dirname);

module.exports = {
  apps: [
    // ===== Backend API =====
    {
      name: "circular-api",
      script: "index.js",
      cwd: path.join(baseDir, "server"),
      exec_mode: "fork",
      watch: false,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
      },
    },
    // ===== Frontend (Vite Dev Server) =====
    {
      name: "circular-frontend",
      script: "./node_modules/vite/bin/vite.js",
      cwd: path.join(baseDir, "client"),
      exec_mode: "fork",
      watch: false,
      autorestart: true,
    },
  ],
};
