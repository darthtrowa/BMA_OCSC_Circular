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
    // ===== Frontend (Development Mode) =====
    {
      name: "ocsc-circular-frontend",
      script: "./node_modules/vite/bin/vite.js",
      cwd: path.join(baseDir, "client"),
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_memory_restart: "500M", // Vite dev server uses more memory
    },
    // ===== Admin Frontend (Development Mode) =====
    {
      name: "ocsc-circular-admin",
      script: "./node_modules/vite/bin/vite.js",
      cwd: path.join(baseDir, "client-admin"),
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_memory_restart: "500M",
    },
  ],
};
