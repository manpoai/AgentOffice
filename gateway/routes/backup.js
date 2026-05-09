/**
 * Data export / backup route.
 * Streams a tar.gz of the gateway DB + uploads directory so users can take
 * their data with them (move to another machine, archive, etc.).
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export default function backupRoutes(app, { authenticateAny }) {
  // GET /api/admin/backup
  // Streams a tar.gz containing gateway.db + uploads/ rooted at the gateway data dir.
  // Auth: admin user only.
  app.get('/api/admin/backup', authenticateAny, (req, res) => {
    if (req.actor?.role !== 'admin') {
      return res.status(403).json({ error: 'ADMIN_REQUIRED' });
    }

    const dbPath = process.env.GATEWAY_DB_PATH;
    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(500).json({ error: 'DB_NOT_FOUND' });
    }

    const dataDir = path.dirname(dbPath);
    const dbName = path.basename(dbPath);
    const uploadsDir = process.env.UPLOADS_DIR || path.join(dataDir, 'uploads');
    const uploadsName = path.basename(uploadsDir);

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const archiveName = `aose-backup-${ts}.tar.gz`;

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);

    // Use system `tar` to stream the archive directly to the response. This
    // keeps memory usage low even for large uploads/ folders.
    const args = ['-czf', '-', '-C', dataDir, dbName];
    if (fs.existsSync(uploadsDir)) args.push('-C', dataDir, uploadsName);

    const tar = spawn('tar', args);
    tar.stdout.pipe(res);
    tar.stderr.on('data', (d) => console.warn('[backup] tar stderr:', d.toString()));
    tar.on('error', (err) => {
      console.error('[backup] tar spawn error:', err.message);
      try { res.status(500).end(); } catch {}
    });
    tar.on('exit', (code) => {
      if (code !== 0) console.warn(`[backup] tar exited with code ${code}`);
    });
    req.on('close', () => { try { tar.kill('SIGTERM'); } catch {} });
  });
}
