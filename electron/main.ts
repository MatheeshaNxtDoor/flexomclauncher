import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { DiscordAuthService } from './services/auth'
import { AccountStore } from './store/accounts'
import { InstanceStore } from './store/instances'
import { LauncherService } from './services/launcher'
import { MinecraftService } from './services/minecraft'
import { ModrinthService } from './services/modrinth'
import { AuthlibService } from './services/authlib'
import { DownloadManager } from './services/downloads'
import { ModLoaderService } from './services/modloader'
import { autoUpdater, UpdateInfo } from 'electron-updater'

const logFile = path.join(app.getPath('userData'), 'launcher.log')
function log(msg: string) {
  try {
    const dir = path.dirname(logFile)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`)
  } catch {}
}

process.on('uncaughtException', (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.stack || err.message}`)
})
process.on('unhandledRejection', (err: any) => {
  log(`UNHANDLED REJECTION: ${err?.stack || err?.message || String(err)}`)
})

let mainWindow: BrowserWindow | null = null
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

log(`Starting. isDev=${isDev} isPackaged=${app.isPackaged} __dirname=${__dirname}`)

function createWindow() {
  log('Creating window...')
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log(`RENDERER CRASHED: ${details.reason} exitCode=${details.exitCode}`)
  })
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    log(`LOAD FAILED: code=${code} desc=${desc}`)
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    const htmlPath = path.join(__dirname, '..', 'dist', 'index.html')
    log(`Loading: ${htmlPath} exists=${fs.existsSync(htmlPath)}`)
    mainWindow.loadFile(htmlPath)
  }

  mainWindow.on('closed', () => { mainWindow = null })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  log('Window created')
}

function sendToRenderer(channel: string, ...args: any[]) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  }
}

function initializeServices() {
  log('Initializing services...')
  const userDataPath = app.getPath('userData')

  const accountStore = new AccountStore(userDataPath)
  const instanceStore = new InstanceStore(userDataPath)
  const discordAuth = new DiscordAuthService()
  const launcherSvc = new LauncherService()
  const minecraftSvc = new MinecraftService(userDataPath)
  const modrinthSvc = new ModrinthService(userDataPath)
  const authlibSvc = new AuthlibService(userDataPath)
  const downloadMgr = new DownloadManager()
  const modLoaderSvc = new ModLoaderService(userDataPath)

  log('Services created')

  downloadMgr.on('job-progress', (data: any) => sendToRenderer('download:job-progress', data))
  downloadMgr.on('job-completed', (data: any) => sendToRenderer('download:job-completed', data))
  downloadMgr.on('task-progress', (data: any) => sendToRenderer('download:task-progress', data))
  downloadMgr.on('task-completed', (data: any) => sendToRenderer('download:task-completed', data))
  downloadMgr.on('task-failed', (data: any) => sendToRenderer('download:task-failed', data))

  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())

  ipcMain.handle('auth:discord-login', async () => {
    const session = await discordAuth.login()
    accountStore.addAccount({
      id: session.playerUuid, type: 'discord', playerName: session.playerName,
      playerUuid: session.playerUuid, accessToken: session.accessToken,
      clientToken: session.clientToken, refreshToken: session.refreshToken,
      authServer: session.authServer, userType: session.userType,
      properties: session.properties, lastPlayed: Date.now(),
    })
    return session
  })

  ipcMain.handle('auth:discord-refresh', async (_e: any, accountId: string) => {
    const account = accountStore.getAccount(accountId)
    if (!account || account.type !== 'discord') throw new Error('Account not found')
    const session = await discordAuth.refresh(account.clientToken, account.refreshToken)
    accountStore.updateAccount(accountId, {
      accessToken: session.accessToken, clientToken: session.clientToken, refreshToken: session.refreshToken,
    })
    return session
  })

  ipcMain.handle('accounts:list', () => accountStore.getAllAccounts())
  ipcMain.handle('accounts:get-current', () => accountStore.getCurrentAccount())
  ipcMain.handle('accounts:set-current', (_e: any, id: string) => { accountStore.setCurrentAccount(id); return true })
  ipcMain.handle('accounts:remove', (_e: any, id: string) => { accountStore.removeAccount(id); return true })

  ipcMain.handle('instances:list', () => instanceStore.getAllInstances())
  ipcMain.handle('instances:get', (_e: any, id: string) => instanceStore.getInstance(id))
  ipcMain.handle('instances:create', (_e: any, config: any) => instanceStore.createInstance(config))
  ipcMain.handle('instances:delete', (_e: any, id: string) => {
    const instance = instanceStore.getInstance(id)
    if (instance?.gameDirectory && fs.existsSync(instance.gameDirectory)) {
      try { fs.rmSync(instance.gameDirectory, { recursive: true, force: true }) } catch {}
    }
    instanceStore.deleteInstance(id)
    return true
  })
  ipcMain.handle('instances:set-last-played', (_e: any, id: string) => { instanceStore.setLastPlayed(id); return true })
  ipcMain.handle('instances:add-mod', (_e: any, instanceId: string, mod: any) => { instanceStore.addMod(instanceId, mod); return true })
  ipcMain.handle('instances:remove-mod', (_e: any, instanceId: string, modId: string) => { instanceStore.removeMod(instanceId, modId); return true })
  ipcMain.handle('instances:update', (_e: any, instanceId: string, updates: any) => { instanceStore.updateInstance(instanceId, updates); return true })

  ipcMain.handle('minecraft:get-version-manifest', async () => minecraftSvc.getVersionManifest())
  ipcMain.handle('minecraft:get-version-json', async (_e: any, versionId: string) => minecraftSvc.getVersionJson(versionId))

  ipcMain.handle('instance:setup', async (_e: any, instanceId: string) => {
    const instance = instanceStore.getInstance(instanceId)
    if (!instance) throw new Error('Instance not found')
    const gameDir = instance.gameDirectory
    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true })

    const loaderLabel = instance.modLoader === 'vanilla' ? 'Vanilla' : instance.modLoader.charAt(0).toUpperCase() + instance.modLoader.slice(1)

    sendToRenderer('instance:setup-progress', { instanceId, step: `Downloading ${loaderLabel} ${instance.version}...` })
    const versionJson = await minecraftSvc.getVersionJson(instance.version)

    const versionDir = path.join(gameDir, 'versions', instance.version)
    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })
    const versionJsonPath = path.join(versionDir, `${instance.version}.json`)
    if (!fs.existsSync(versionJsonPath)) {
      fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2))
    }

    sendToRenderer('instance:setup-progress', { instanceId, step: 'Downloading client jar...' })
    await minecraftSvc.downloadClientJar(versionJson, gameDir)

    sendToRenderer('instance:setup-progress', { instanceId, step: 'Downloading asset index...' })
    const assetIndex = await minecraftSvc.downloadAssetIndex(versionJson, gameDir)

    sendToRenderer('instance:setup-progress', { instanceId, step: 'Downloading assets...' })
    await minecraftSvc.downloadAssets(assetIndex, gameDir, (progress: any) => {
      sendToRenderer('instance:setup-progress', { instanceId, step: `Assets: ${progress.percent}%` })
    })

    sendToRenderer('instance:setup-progress', { instanceId, step: 'Downloading libraries...' })
    await minecraftSvc.downloadLibraries(versionJson, gameDir, (progress: any) => {
      sendToRenderer('instance:setup-progress', { instanceId, step: `Libraries: ${progress.percent}%` })
    })

    if (instance.modLoader !== 'vanilla') {
      sendToRenderer('instance:setup-progress', { instanceId, step: `Installing ${loaderLabel} mod loader...` })
      const loaderResult = await modLoaderSvc.installLoader(
        instance.modLoader, instance.version, gameDir, (msg) => {
          sendToRenderer('instance:setup-progress', { instanceId, step: msg })
        },
        instance.modLoaderVersion
      )

      instanceStore.updateInstance(instanceId, { versionId: loaderResult.versionId })

      const clientJar = path.join(gameDir, 'versions', loaderResult.versionId, `${loaderResult.versionId}.jar`)
      if (!fs.existsSync(clientJar)) {
        const vanillaJar = path.join(gameDir, 'versions', instance.version, `${instance.version}.jar`)
        if (fs.existsSync(vanillaJar)) {
          const versionDir = path.dirname(clientJar)
          if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })
          fs.copyFileSync(vanillaJar, clientJar)
        }
      }
    }

    if (accountStore.getCurrentAccount()?.type === 'discord') {
      sendToRenderer('instance:setup-progress', { instanceId, step: 'Downloading authlib-injector...' })
      await authlibSvc.downloadAuthlibInjector()
    }

    sendToRenderer('instance:setup-progress', { instanceId, step: 'Setup complete!', done: true })
    return { success: true }
  })

  ipcMain.handle('launcher:launch', async (_e: any, instanceId: string) => {
    log(`LAUNCH START: instanceId=${instanceId}`)
    try {
      const { launch } = await import('@xmcl/core')

      const account = accountStore.getCurrentAccount()
      if (!account) { log('LAUNCH FAIL: No account selected'); throw new Error('No account selected') }
      const instance = instanceStore.getInstance(instanceId)
      if (!instance) { log('LAUNCH FAIL: Instance not found'); throw new Error('Instance not found') }
      log(`LAUNCH: account=${account.playerName} type=${account.type} version=${instance.version}`)

      const gameDir = instance.gameDirectory
      log(`LAUNCH: gameDir=${gameDir} exists=${fs.existsSync(gameDir)}`)
      if (!fs.existsSync(gameDir)) throw new Error('Instance not set up. Run setup first.')

      const effectiveVersionId = instance.versionId || instance.version
      log(`LAUNCH: effectiveVersionId=${effectiveVersionId}`)

      const effectiveVersionDir = path.join(gameDir, 'versions', effectiveVersionId)
      const effectiveVersionJson = path.join(effectiveVersionDir, `${effectiveVersionId}.json`)
      if (!fs.existsSync(effectiveVersionJson)) {
        log(`LAUNCH: version JSON missing, fetching...`)
        try {
          const vJson = await minecraftSvc.getVersionJson(effectiveVersionId, gameDir)
          if (!fs.existsSync(effectiveVersionDir)) fs.mkdirSync(effectiveVersionDir, { recursive: true })
          fs.writeFileSync(effectiveVersionJson, JSON.stringify(vJson, null, 2))
        } catch (e: any) {
          log(`LAUNCH: failed to fetch version JSON: ${e.message}`)
        }
      }

      const vanillaVersionDir = path.join(gameDir, 'versions', instance.version)
      const vanillaVersionJson = path.join(vanillaVersionDir, `${instance.version}.json`)
      if (!fs.existsSync(vanillaVersionJson) && effectiveVersionId !== instance.version) {
        log(`LAUNCH: vanilla version JSON missing, fetching...`)
        try {
          const vJson = await minecraftSvc.getVersionJson(instance.version, gameDir)
          if (!fs.existsSync(vanillaVersionDir)) fs.mkdirSync(vanillaVersionDir, { recursive: true })
          fs.writeFileSync(vanillaVersionJson, JSON.stringify(vJson, null, 2))
        } catch (e: any) {
          log(`LAUNCH: failed to fetch vanilla version JSON: ${e.message}`)
        }
      }

      const clientJar = path.join(gameDir, 'versions', effectiveVersionId, `${effectiveVersionId}.jar`)
      log(`LAUNCH: clientJar=${clientJar} exists=${fs.existsSync(clientJar)}`)
      if (!fs.existsSync(clientJar)) throw new Error('Client jar not found. Run instance setup first.')

      const javaPath = await launcherSvc.findJava()
      log(`LAUNCH: javaPath=${javaPath}`)
      if (!javaPath) throw new Error('Java not found.')

      const launchOpts: any = {
        gamePath: gameDir,
        javaPath,
        version: effectiveVersionId,
        maxMemory: instance.maxMemory || 4096,
        minMemory: instance.minMemory || 1024,
        launcherName: 'Flexo',
        launcherBrand: '1.0.0',
        extraJVMArgs: [
          '-Djava.net.preferIPv4Stack=true',
          ...(instance.jvmArgs || []),
        ],
        gameProfile: {
          name: account.playerName,
          id: account.playerUuid,
        },
        accessToken: account.accessToken || '',
        userType: (account.userType as any) || 'msa',
        properties: account.properties || {},
      }

      if (account.type === 'discord') {
        const authlibInjectorPath = await authlibSvc.downloadAuthlibInjector()
        const authlibInjectorUrl = account.authServer || 'https://auth.flexo.lol/authlib-injector'
        log(`LAUNCH: authlibInjector=${authlibInjectorPath} url=${authlibInjectorUrl}`)
        launchOpts.yggdrasilAgent = {
          jar: authlibInjectorPath,
          server: authlibInjectorUrl,
        }
      }

      log(`LAUNCH: calling @xmcl/core launch()`)
      const proc = await launch(launchOpts)
      log(`LAUNCH: process spawned pid=${proc.pid}`)

      proc.stdout?.on('data', (data: Buffer) => {
        sendToRenderer('launcher:game-log', { instanceId, stream: 'stdout', data: data.toString() })
      })
      proc.stderr?.on('data', (data: Buffer) => {
        sendToRenderer('launcher:game-log', { instanceId, stream: 'stderr', data: data.toString() })
      })
      proc.on('error', (err) => {
        log(`LAUNCH ERROR: ${err.message}`)
        sendToRenderer('launcher:game-error', { instanceId, error: err.message })
      })
      proc.on('exit', (code) => {
        log(`LAUNCH EXIT: instanceId=${instanceId} code=${code}`)
        sendToRenderer('launcher:game-exited', { instanceId, code })
      })
      launcherSvc.setRunning(instanceId, proc)
      instanceStore.setLastPlayed(instanceId)
      return { pid: proc.pid }
    } catch (err: any) {
      log(`LAUNCH FAIL: ${err.stack || err.message}`)
      throw err
    }
  })

  ipcMain.handle('instances:is-installed', (_e: any, instanceId: string) => {
    const instance = instanceStore.getInstance(instanceId)
    if (!instance) return false
    const effectiveVersionId = instance.versionId || instance.version
    const clientJar = path.join(instance.gameDirectory, 'versions', effectiveVersionId, `${effectiveVersionId}.jar`)
    return fs.existsSync(clientJar)
  })

  ipcMain.handle('launcher:is-running', (_e: any, instanceId: string) => launcherSvc.isRunning(instanceId))

  ipcMain.handle('launcher:get-java-path', () => launcherSvc.findJava())
  ipcMain.handle('launcher:kill', (_e: any, instanceId: string) => { launcherSvc.kill(instanceId); return true })

  ipcMain.handle('downloads:create-job', (_e: any, id: string, label: string, tasks: any[]) => downloadMgr.createJob(id, label, tasks))
  ipcMain.handle('downloads:start-job', async (_e: any, jobId: string) => { await downloadMgr.startJob(jobId) })
  ipcMain.handle('downloads:cancel-job', (_e: any, jobId: string) => { downloadMgr.cancelJob(jobId) })
  ipcMain.handle('downloads:get-job', (_e: any, jobId: string) => downloadMgr.getJob(jobId))
  ipcMain.handle('downloads:get-all-jobs', () => downloadMgr.getAllJobs())

  ipcMain.handle('marketplace:search', async (_e: any, query: string, filters?: any) => modrinthSvc.searchMods(query, filters))
  ipcMain.handle('marketplace:get-project', async (_e: any, projectId: string) => modrinthSvc.getProject(projectId))
  ipcMain.handle('marketplace:get-versions', async (_e: any, projectId: string, filters?: any) => modrinthSvc.getProjectVersions(projectId, filters))
  ipcMain.handle('marketplace:get-multiple-projects', async (_e: any, projectIds: string[]) => modrinthSvc.getMultipleProjects(projectIds))
  ipcMain.handle('marketplace:get-multiple-versions', async (_e: any, versionIds: string[]) => modrinthSvc.getMultipleVersions(versionIds))
  ipcMain.handle('marketplace:install-mod', async (_e: any, projectId: string, versionId: string, targetDir: string) => {
    const versions = await modrinthSvc.getProjectVersions(projectId)
    const version = versions.find((v: any) => v.id === versionId)
    if (!version) throw new Error('Version not found')
    return modrinthSvc.downloadMod(version, targetDir)
  })
  ipcMain.handle('marketplace:resolve-dependencies', async (_e: any, versionId: string, gameVersion: string, loader: string) => {
    return modrinthSvc.resolveDependencies(versionId, gameVersion, loader)
  })

  ipcMain.handle('modpack:install', async (_e: any, modpackUrl: string, instanceDir: string, onProgress?: (msg: string) => void) => {
    return modrinthSvc.installModpack(modpackUrl, instanceDir, onProgress)
  })
  ipcMain.handle('authlib:download', async () => authlibSvc.downloadAuthlibInjector())

  ipcMain.handle('modloader:install', async (_e: any, modLoader: string, gameVersion: string, gameDir: string, loaderVersion?: string) => {
    return modLoaderSvc.installLoader(modLoader as any, gameVersion, gameDir, undefined, loaderVersion)
  })
  ipcMain.handle('modloader:get-versions', async (_e: any, modLoader: string, gameVersion: string) => {
    return modLoaderSvc.getAvailableVersions(modLoader as any, gameVersion)
  })

  ipcMain.handle('settings:get', () => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json')
    if (fs.existsSync(settingsPath)) return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    return { javaPath: '', maxMemory: 4096, minMemory: 1024, gameDirectory: path.join(app.getPath('userData'), 'instances'), jvmArgs: [] }
  })
  ipcMain.handle('settings:save', (_e: any, settings: any) => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json')
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    return true
  })

  ipcMain.handle('updater:check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return result
    } catch (e: any) {
      log(`UPDATE CHECK FAILED: ${e.message}`)
      sendToRenderer('updater:error', e.message)
      return null
    }
  })
  ipcMain.handle('updater:download-update', async () => {
    await autoUpdater.downloadUpdate()
  })
  ipcMain.handle('updater:install-update', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('app:get-info', () => ({ version: app.getVersion(), name: app.getName(), isDev }))

  log('All IPC handlers registered')
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.forceDevUpdateConfig = false
  autoUpdater.logger = {
    info: (msg: string) => log(`[updater] ${msg}`),
    warn: (msg: string) => log(`[updater] ${msg}`),
    error: (msg: string) => log(`[updater] ${msg}`),
    debug: (msg: string) => log(`[updater:debug] ${msg}`),
  } as any

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log(`UPDATE AVAILABLE: ${info.version}`)
    sendToRenderer('updater:update-available', { version: info.version, releaseDate: info.releaseDate })
  })
  autoUpdater.on('update-not-available', () => {
    log('UPDATE: already up to date')
    sendToRenderer('updater:update-not-available')
  })
  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('updater:download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })
  autoUpdater.on('update-downloaded', () => {
    log('UPDATE: downloaded, installing now')
    sendToRenderer('updater:update-downloaded')
    autoUpdater.quitAndInstall()
  })
  autoUpdater.on('error', (err) => {
    log(`UPDATE ERROR: ${err.message}`)
    sendToRenderer('updater:error', err.message)
  })
}

app.whenReady().then(async () => {
  log('app.whenReady fired')
  createWindow()
  initializeServices()
  setupAutoUpdater()
  log('Initialization complete')

  if (!isDev) {
    setTimeout(async () => {
      try {
        const result = await autoUpdater.checkForUpdates()
        log(`UPDATE CHECK: ${result?.updateInfo?.version || 'no update found'}`)
      } catch (e: any) {
        log(`UPDATE CHECK FAILED: ${e.message}`)
      }
    }, 5000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  log('window-all-closed')
  if (process.platform !== 'darwin') app.quit()
})
