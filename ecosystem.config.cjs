module.exports = {
  apps: [
    {
      name: "mc-backend",
      cwd: "./backend",
      script: ".venv/bin/uvicorn",
      args: "app.main:app --host 0.0.0.0 --port 8000",
      interpreter: "none",
      env: {
        PYTHONPATH: ".",
      },
      max_restarts: 5,
      restart_delay: 3000,
    },
    {
      name: "mc-frontend",
      cwd: "./frontend",
      script: "node_modules/.bin/next",
      args: "start --port 3000",
      interpreter: "none",
      max_restarts: 5,
      restart_delay: 3000,
    },
    {
      name: "mc-bridge",
      cwd: "./bridge",
      script: "../backend/.venv/bin/uvicorn",
      args: "app:app --host 0.0.0.0 --port 8100",
      interpreter: "none",
      env: {
        BRIDGE_TOKEN: "mc-bridge-local-dev-token-2026",
        OPENCLAW_DIR: "/Users/michaeldowling/.openclaw",
      },
      max_restarts: 5,
      restart_delay: 3000,
    },
    {
      name: "mc-tunnel",
      script: "ngrok",
      args: "http 8100 --url=narrativemission.ngrok.app",
      interpreter: "none",
      max_restarts: 5,
      restart_delay: 5000,
    },
  ],
};
