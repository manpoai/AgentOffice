function setupUpdater() {
  try {
    const { autoUpdater } = require('electron-updater');

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      console.log('[updater] Update available:', info.version);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[updater] Update downloaded:', info.version);
    });

    autoUpdater.on('error', (err) => {
      console.error('[updater] Error:', err.message);
    });

    autoUpdater.checkForUpdatesAndNotify();
    setInterval(() => autoUpdater.checkForUpdates(), 3600000);
  } catch (err) {
    console.log('[updater] Auto-updater not available:', err.message);
  }
}

module.exports = { setupUpdater };
