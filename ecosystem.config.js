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
    // Using "cmd /c" is the most reliable way to run npm scripts via PM2 on Windows
    {
      name: "circular-frontend",
      script: "cmd",
      args: "/c npm run dev",
      cwd: path.join(baseDir, "client"),
      exec_mode: "fork",
      watch: false,
      interpreter: "none",
      autorestart: true,
    },
  ],
};
