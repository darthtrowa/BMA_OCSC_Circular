const path = require("path");
const baseDir = path.resolve(__dirname);

module.exports = {
  apps: [
    // ===== Backend API =====
    {
      name: "circular-api",
      script: "./node_modules/tsx/dist/cli.mjs",
      args: "./src/index.ts",
      cwd: path.join(baseDir, "server"),
      exec_mode: "fork",
      interpreter: "node", // ระบุให้ใช้ node รันเสมอ
      watch: false,
      env: {
        NODE_ENV: "development",
      },
    },
    // ===== Frontend (Vite) =====
    {
      name: "circular-frontend",
      script: "./node_modules/vite/bin/vite.js",
      cwd: path.join(baseDir, "client"),
      exec_mode: "fork",
      interpreter: "node", // ระบุให้ใช้ node รันเสมอ
      watch: false,
      autorestart: true,
    },
  ],
};
