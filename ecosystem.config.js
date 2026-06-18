const path = require("path");
const baseDir = path.resolve(__dirname);

module.exports = {
  apps: [
    // ===== Backend API =====
    {
      name: "ocsc-circular-api",
      script: "./dist/index.js", // Use compiled JS instead of tsx
      cwd: path.join(baseDir, "server"),
      exec_mode: "fork",
      interpreter: "node", // ระบุให้ใช้ node รันเสมอ
      watch: false,
      max_memory_restart: "500M", // Restart if RAM exceeds 500MB
      env: {
        NODE_ENV: "production",
      },
    },
    // ===== Frontend (Production Mode) =====
    {
      name: "ocsc-circular-frontend",
      script: "./serve.js",
      cwd: path.join(baseDir, "client"),
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_memory_restart: "200M",
      env: {
        NODE_ENV: "production",
      },
    },
    // ===== Admin Frontend (Production Mode) =====
    {
      name: "ocsc-circular-admin",
      script: "./server.mjs",
      cwd: path.join(baseDir, "client-admin"),
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_memory_restart: "200M",
      env: {
        NODE_ENV: "production",
        PORT: 5175,
      },
    },
  ],
};
