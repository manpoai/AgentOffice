const pty = require('node-pty');
const os = require('os');

class TerminalManager {
  constructor() {
    this.terminals = new Map();
  }

  create(agentId, options = {}) {
    if (this.terminals.has(agentId)) {
      return { pid: this.terminals.get(agentId).pty.pid };
    }

    const shell = options.shell || (os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh');
    const cols = options.cols || 80;
    const rows = options.rows || 24;

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: options.cwd || os.homedir(),
      env: { ...process.env, ...options.env },
    });

    this.terminals.set(agentId, { pty: ptyProcess, cols, rows });
    return { pid: ptyProcess.pid };
  }

  write(agentId, data) {
    const entry = this.terminals.get(agentId);
    if (entry) entry.pty.write(data);
  }

  resize(agentId, cols, rows) {
    const entry = this.terminals.get(agentId);
    if (entry) {
      entry.pty.resize(cols, rows);
      entry.cols = cols;
      entry.rows = rows;
    }
  }

  onData(agentId, callback) {
    const entry = this.terminals.get(agentId);
    if (entry) return entry.pty.onData(callback);
    return null;
  }

  onExit(agentId, callback) {
    const entry = this.terminals.get(agentId);
    if (entry) return entry.pty.onExit(callback);
    return null;
  }

  destroy(agentId) {
    const entry = this.terminals.get(agentId);
    if (entry) {
      entry.pty.kill();
      this.terminals.delete(agentId);
    }
  }

  destroyAll() {
    for (const [id] of this.terminals) {
      this.destroy(id);
    }
  }

  list() {
    const result = [];
    for (const [agentId, entry] of this.terminals) {
      result.push({ agentId, pid: entry.pty.pid, cols: entry.cols, rows: entry.rows });
    }
    return result;
  }
}

module.exports = { TerminalManager };
