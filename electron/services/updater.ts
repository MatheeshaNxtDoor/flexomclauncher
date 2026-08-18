import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'

export class UpdaterService {
  private window: BrowserWindow

  constructor(window: BrowserWindow) {
    this.window = window
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('update-available', (info) => {
      this.window.webContents.send('updater:update-available', info)
    })
    autoUpdater.on('update-not-available', () => {
      this.window.webContents.send('updater:update-not-available')
    })
    autoUpdater.on('download-progress', (progress) => {
      this.window.webContents.send('updater:download-progress', progress)
    })
    autoUpdater.on('update-downloaded', () => {
      this.window.webContents.send('updater:update-downloaded')
    })
    autoUpdater.on('error', (err) => {
      this.window.webContents.send('updater:error', err.message)
    })
  }

  async checkForUpdates() {
    try {
      return await autoUpdater.checkForUpdates()
    } catch (e) {
      return null
    }
  }

  async downloadUpdate() {
    await autoUpdater.downloadUpdate()
  }

  installUpdate() {
    autoUpdater.quitAndInstall()
  }
}
