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
import { autoUpdater } from 'electron-updater'

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
    log(`__dirname contents: ${fs.readdirSync(__dirname).join(', ')}`)
    const upDir = path.join(__dirname, '..')
    log(`parent contents: ${fs.readdirSync(upDir).join(', ')}`)
    const distDir = path.join(upDir, 'dist')
    if (fs.existsSync(distDir)) {
      log(`dist contents: ${fs.readdirSync(distDir).join(', ')}`)
    }
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
  mainWindow?.webContents.send(channel, ...args)
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
  ipcMain.handle('instances:delete', (_e: any, id: string) => { instanceStore.deleteInstance(id); return true })
  ipcMain.handle('instances:set-last-played', (_e: any, id: string) => { instanceStore.setLastPlayed(id); return true })
  ipcMain.handle('instances:add-mod', (_e: any, instanceId: string, mod: any) => { instanceStore.addMod(instanceId, mod); return true })
  ipcMain.handle('instances:remove-mod', (_e: any, instanceId: string, modId: string) => { instanceStore.removeMod(instanceId, modId); return true })

  ipcMain.handle('minecraft:get-version-manifest', async () => minecraftSvc.getVersionManifest())
  ipcMain.handle('minecraft:get-version-json', async (_e: any, versionId: string) => minecraftSvc.getVersionJson(versionId))

  ipcMain.handle('instance:setup', async (_e: any, instanceId: string) => {
    const instance = instanceStore.getInstance(instanceId)
    if (!instance) throw new Error('Instance not found')
    const gameDir = instance.gameDirectory
    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true })

    sendToRenderer('instance:setup-progress', { instanceId, step: 'Fetching version info...' })
    const versionJson = await minecraftSvc.getVersionJson(instance.version)

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

    if (instanceStore.getInstance(instanceId)?.modLoader !== 'vanilla') {
      sendToRenderer('instance:setup-progress', { instanceId, step: 'Downloading authlib-injector...' })
      await authlibSvc.downloadAuthlibInjector()
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
      const account = accountStore.getCurrentAccount()
      if (!account) { log('LAUNCH FAIL: No account selected'); throw new Error('No account selected') }
      const instance = instanceStore.getInstance(instanceId)
      if (!instance) { log('LAUNCH FAIL: Instance not found'); throw new Error('Instance not found') }
      log(`LAUNCH: account=${account.playerName} type=${account.type} version=${instance.version}`)

      const gameDir = instance.gameDirectory
      log(`LAUNCH: gameDir=${gameDir} exists=${fs.existsSync(gameDir)}`)
      if (!fs.existsSync(gameDir)) throw new Error('Instance not set up. Run setup first.')

      const versionJson = await minecraftSvc.getVersionJson(instance.version)
      const librariesDir = path.join(gameDir, 'libraries')
      const classpath = minecraftSvc.buildClasspath(versionJson, librariesDir)
      const clientJar = path.join(gameDir, 'versions', instance.version, `${instance.version}.jar`)
      log(`LAUNCH: clientJar=${clientJar} exists=${fs.existsSync(clientJar)}`)
      if (!fs.existsSync(clientJar)) throw new Error('Client jar not found. Run instance setup first.')

      const separator = process.platform === 'win32' ? ';' : ':'
      const fullClasspath = `${clientJar}${separator}${classpath}`
      const assetsDir = path.join(gameDir, 'assets')
      const nativesDir = path.join(gameDir, 'versions', instance.version, 'natives')

      let authlibInjectorPath: string | undefined
      let authlibInjectorUrl: string | undefined
      if (account.type === 'discord') {
        authlibInjectorPath = await authlibSvc.downloadAuthlibInjector()
        authlibInjectorUrl = account.authServer || 'https://auth.flexo.lol/authlib-injector'
        log(`LAUNCH: authlibInjector=${authlibInjectorPath} url=${authlibInjectorUrl}`)
      }

      const javaArgs = minecraftSvc.buildJvmArgs(versionJson, {
        classpath: fullClasspath, gameDir, nativesDir,
        maxMemory: instance.maxMemory || 4096, minMemory: instance.minMemory || 1024,
        javaPath: 'java', authlibInjectorPath, authlibInjectorUrl, jvmArgs: instance.jvmArgs,
      })

      const gameArgs = minecraftSvc.buildGameArgs(versionJson, {
        username: account.playerName, uuid: account.playerUuid, accessToken: account.accessToken,
        userType: account.userType || 'mojang', gameDir, assetsDir, properties: account.properties,
      })

      const javaPath = await launcherSvc.findJava()
      log(`LAUNCH: javaPath=${javaPath}`)
      if (!javaPath) throw new Error('Java not found.')

      const mainClass = versionJson.mainClassClient || versionJson.mainClass
      log(`LAUNCH: mainClass=${mainClass}`)
      log(`LAUNCH: javaArgs=${JSON.stringify(javaArgs)}`)
      log(`LAUNCH: gameArgs=${JSON.stringify(gameArgs)}`)

      const { spawn } = await import('child_process')
      const proc = spawn(javaPath, [...javaArgs, mainClass, ...gameArgs], {
        cwd: gameDir, stdio: ['ignore', 'pipe', 'pipe'],
      })
      log(`LAUNCH: process spawned pid=${proc.pid}`)

      proc.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString()
        log(`GAME STDOUT: ${msg.trim()}`)
        sendToRenderer('launcher:game-log', { instanceId, stream: 'stdout', data: msg })
      })
      proc.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString()
        log(`GAME STDERR: ${msg.trim()}`)
        sendToRenderer('launcher:game-log', { instanceId, stream: 'stderr', data: msg })
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
    const clientJar = path.join(instance.gameDirectory, 'versions', instance.version, `${instance.version}.jar`)
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
  ipcMain.handle('marketplace:install-mod', async (_e: any, projectId: string, versionId: string, targetDir: string) => {
    const versions = await modrinthSvc.getProjectVersions(projectId)
    const version = versions.find((v: any) => v.id === versionId)
    if (!version) throw new Error('Version not found')
    return modrinthSvc.downloadMod(version, targetDir)
  })

  ipcMain.handle('modpack:install', async (_e: any, modpackUrl: string, instanceDir: string) => modrinthSvc.installModpack(modpackUrl, instanceDir))
  ipcMain.handle('authlib:download', async () => authlibSvc.downloadAuthlibInjector())

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

app.whenReady().then(async () => {
  log('app.whenReady fired')
  createWindow()
  initializeServices()
  log('Initialization complete')

  // Auto-update: configure once, check on startup (non-blocking)
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = {
    info: (msg: string) => log(`[updater] ${msg}`),
    warn: (msg: string) => log(`[updater] ${msg}`),
    error: (msg: string) => log(`[updater] ${msg}`),
    debug: (msg: string) => log(`[updater:debug] ${msg}`),
  } as any
  autoUpdater.on('update-available', (info) => {
    log(`UPDATE AVAILABLE: ${info.version}`)
    sendToRenderer('updater:update-available', info)
  })
  autoUpdater.on('update-not-available', () => {
    log('UPDATE: already up to date')
    sendToRenderer('updater:update-not-available')
  })
  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('updater:download-progress', progress)
  })
  autoUpdater.on('update-downloaded', () => {
    log('UPDATE: downloaded, will install on quit')
    sendToRenderer('updater:update-downloaded')
  })
  autoUpdater.on('error', (err) => {
    log(`UPDATE ERROR: ${err.message}`)
    sendToRenderer('updater:error', err.message)
  })

  setTimeout(async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      log(`UPDATE CHECK: ${result?.updateInfo?.version || 'no update found'}`)
    } catch (e: any) {
      log(`UPDATE CHECK FAILED: ${e.message}`)
    }
  }, 3000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  log('window-all-closed')
  if (process.platform !== 'darwin') app.quit()
})
