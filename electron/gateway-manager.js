const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');

function findSystemNode() {
  try {
    return execSync('which node', { encoding: 'utf-8' }).trim();
  } catch {
    return 'node';
  }
}

class GatewayManager {
  constructor() {
    this.process = null;
    this.port = 4000;
  }

  start(options = {}) {
    if (this.process) return;

    const gatewayDir = path.join(__dirname, '..', 'gateway');
    this.port = options.port || 4000;

    const nodeBin = findSystemNode();
    this.process = spawn(nodeBin, [path.join(gatewayDir, 'server.js')], {
      env: {
        ...process.env,
        GATEWAY_PORT: String(this.port),
        GATEWAY_DB_PATH: options.dbPath,
        UPLOADS_DIR: options.uploadsDir,
        JWT_SECRET: options.jwtSecret,
        ADMIN_TOKEN: options.adminToken,
        CORS_ORIGIN: options.corsOrigin || '*',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout.on('data', (data) => {
      console.log(`[gateway] ${data.toString().trim()}`);
    });

    this.process.stderr.on('data', (data) => {
      console.error(`[gateway] ${data.toString().trim()}`);
    });

    this.process.on('exit', (code) => {
      console.log(`[gateway] exited with code ${code}`);
      this.process = null;
    });
  }

  waitReady(timeout = 15000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        if (Date.now() - start > timeout) {
          return reject(new Error('Gateway startup timeout'));
        }
        const req = http.get(`http://127.0.0.1:${this.port}/api/health`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            setTimeout(check, 300);
          }
        });
        req.on('error', () => setTimeout(check, 300));
        req.setTimeout(2000, () => { req.destroy(); setTimeout(check, 300); });
      };
      check();
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.process) return resolve();

      const timeout = setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      this.process.once('exit', () => {
        clearTimeout(timeout);
        this.process = null;
        resolve();
      });

      this.process.kill('SIGTERM');
    });
  }
}

module.exports = { GatewayManager };
