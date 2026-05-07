const pty = require('node-pty');
const os = require('os');

class TerminalManager {
  constructor() {
    this.terminals = new Map();
  }

  create(agentId, options = {}) {
    if (this.terminals.has(agentId)) {
      const entry = this.terminals.get(agentId);
      this._disposeListeners(entry);
      return { pid: entry.pty.pid, reconnected: true };
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

    this.terminals.set(agentId, { pty: ptyProcess, cols, rows, disposables: [] });
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
    if (!entry) return null;
    const disposable = entry.pty.onData(callback);
    entry.disposables.push(disposable);
    return disposable;
  }

  onExit(agentId, callback) {
    const entry = this.terminals.get(agentId);
    if (!entry) return null;
    const disposable = entry.pty.onExit(callback);
    entry.disposables.push(disposable);
    return disposable;
  }

  _disposeListeners(entry) {
    if (entry.disposables) {
      for (const d of entry.disposables) {
        if (d && typeof d.dispose === 'function') d.dispose();
      }
      entry.disposables = [];
    }
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
