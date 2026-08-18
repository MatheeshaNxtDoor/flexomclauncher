import { app, BrowserWindow, ipcMain, shell, protocol } from 'electron'
import path from 'path'
import fs from 'fs'
import { DiscordAuthService } from './services/auth'
import { AccountStore } from './store/accounts'
import { InstanceStore } from './store/instances'
import { UpdaterService } from './services/updater'
import { LauncherService } from './services/launcher'
import { MinecraftService, DownloadProgress } from './services/minecraft'
import { ModrinthService } from './services/modrinth'
import { AuthlibService } from './services/authlib'
import { DownloadManager } from './services/downloads'

let mainWindow: BrowserWindow | null = null
let discordAuth: DiscordAuthService | null = null
let accountStore: AccountStore | null = null
let instanceStore: InstanceStore | null = null
let updaterService: UpdaterService | null = null
let launcherService: LauncherService | null = null
let minecraftService: MinecraftService | null = null
let modrinthService: ModrinthService | null = null
let authlibService: AuthlibService | null = null
let downloadManager: DownloadManager | null = null

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function sendToRenderer(channel: string, ...args: any[]) {
  mainWindow?.webContents.send(channel, ...args)
}

function initializeServices() {
  const userDataPath = app.getPath('userData')

  accountStore = new AccountStore(userDataPath)
  instanceStore = new InstanceStore(userDataPath)
  discordAuth = new DiscordAuthService()
  launcherService = new LauncherService(userDataPath)
  minecraftService = new MinecraftService(userDataPath)
  modrinthService = new ModrinthService(userDataPath)
  authlibService = new AuthlibService(userDataPath)
  downloadManager = new DownloadManager()
  updaterService = new UpdaterService(mainWindow!)

  // Forward download manager events to renderer
  downloadManager.on('job-progress', (data) => sendToRenderer('download:job-progress', data))
  downloadManager.on('job-completed', (data) => sendToRenderer('download:job-completed', data))
  downloadManager.on('task-progress', (data) => sendToRenderer('download:task-progress', data))
  downloadManager.on('task-completed', (data) => sendToRenderer('download:task-completed', data))
  downloadManager.on('task-failed', (data) => sendToRenderer('download:task-failed', data))

  // ── Window ──
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())

  // ── Auth ──
  ipcMain.handle('auth:discord-login', async () => {
    const session = await discordAuth!.login()
    accountStore!.addAccount({
      id: session.playerUuid,
      type: 'discord',
      playerName: session.playerName,
      playerUuid: session.playerUuid,
      accessToken: session.accessToken,
      clientToken: session.clientToken,
      refreshToken: session.refreshToken,
      authServer: session.authServer,
      userType: session.userType,
      properties: session.properties,
      lastPlayed: Date.now(),
    })
    return session
  })

  ipcMain.handle('auth:discord-refresh', async (_event, accountId: string) => {
    const account = accountStore!.getAccount(accountId)
    if (!account || account.type !== 'discord') throw new Error('Account not found')
    const session = await discordAuth!.refresh(account.clientToken, account.refreshToken)
    accountStore!.updateAccount(accountId, {
      accessToken: session.accessToken,
      clientToken: session.clientToken,
      refreshToken: session.refreshToken,
    })
    return session
  })

  // ── Accounts ──
  ipcMain.handle('accounts:list', () => accountStore!.getAllAccounts())
  ipcMain.handle('accounts:get-current', () => accountStore!.getCurrentAccount())
  ipcMain.handle('accounts:set-current', (_e, id: string) => { accountStore!.setCurrentAccount(id); return true })
  ipcMain.handle('accounts:remove', (_e, id: string) => { accountStore!.removeAccount(id); return true })

  // ── Instances ──
  ipcMain.handle('instances:list', () => instanceStore!.getAllInstances())
  ipcMain.handle('instances:get', (_e, id: string) => instanceStore!.getInstance(id))
  ipcMain.handle('instances:create', (_e, config: any) => instanceStore!.createInstance(config))
  ipcMain.handle('instances:delete', (_e, id: string) => { instanceStore!.deleteInstance(id); return true })
  ipcMain.handle('instances:set-last-played', (_e, id: string) => { instanceStore!.setLastPlayed(id); return true })
  ipcMain.handle('instances:add-mod', (_e, instanceId: string, mod: any) => { instanceStore!.addMod(instanceId, mod); return true })
  ipcMain.handle('instances:remove-mod', (_e, instanceId: string, modId: string) => { instanceStore!.removeMod(instanceId, modId); return true })

  // ── Minecraft version manifest ──
  ipcMain.handle('minecraft:get-version-manifest', async () => {
    return minecraftService!.getVersionManifest()
  })

  ipcMain.handle('minecraft:get-version-json', async (_e, versionId: string) => {
    return minecraftService!.getVersionJson(versionId)
  })

  // ── Instance setup (downloads everything needed to play) ──
  ipcMain.handle('instance:setup', async (_e, instanceId: string) => {
    const instance = instanceStore!.getInstance(instanceId)
    if (!instance) throw new Error('Instance not found')

    const gameDir = instance.gameDirectory
    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true })

    // 1. Fetch version JSON
    sendToRenderer('instance:setup-progress', { instanceId, step: 'Fetching version info...' })
    const versionJson = await minecraftService!.getVersionJson(instance.version)

    // 2. Download client jar
    sendToRenderer('instance:setup-progress', { instanceId, step: 'Downloading client jar...' })
    await minecraftService!.downloadClientJar(versionJson, gameDir)

    // 3. Download asset index
    sendToRenderer('instance:setup-progress', { instanceId, step: 'Downloading asset index...' })
    const assetIndex = await minecraftService!.downloadAssetIndex(versionJson, gameDir)

    // 4. Download assets
    sendToRenderer('instance:setup-progress', { instanceId, step: 'Downloading assets...' })
    await minecraftService!.downloadAssets(assetIndex, gameDir, (progress) => {
      sendToRenderer('instance:setup-progress', { instanceId, step: `Assets: ${progress.percent}% (${progress.downloaded}/${progress.total})` })
    })

    // 5. Download libraries
    sendToRenderer('instance:setup-progress', { instanceId, step: 'Downloading libraries...' })
    await minecraftService!.downloadLibraries(versionJson, gameDir, (progress) => {
      sendToRenderer('instance:setup-progress', { instanceId, step: `Libraries: ${progress.percent}% (${progress.downloaded}/${progress.total})` })
    })

    // 6. Download authlib-injector if needed
    if (instanceStore!.getInstance(instanceId)?.modLoader !== 'vanilla') {
      sendToRenderer('instance:setup-progress', { instanceId, step: 'Downloading authlib-injector...' })
      await authlibService!.downloadAuthlibInjector()
    }

    sendToRenderer('instance:setup-progress', { instanceId, step: 'Setup complete!', done: true })
    return { success: true }
  })

  // ── Game launch ──
  ipcMain.handle('launcher:launch', async (_e, instanceId: string) => {
    const account = accountStore!.getCurrentAccount()
    if (!account) throw new Error('No account selected')
    const instance = instanceStore!.getInstance(instanceId)
    if (!instance) throw new Error('Instance not found')

    const gameDir = instance.gameDirectory
    if (!fs.existsSync(gameDir)) throw new Error('Instance not set up. Run setup first.')

    const versionJson = await minecraftService!.getVersionJson(instance.version)
    const librariesDir = path.join(gameDir, 'libraries')
    const classpath = minecraftService!.buildClasspath(versionJson, librariesDir)
    const clientJar = path.join(gameDir, 'versions', instance.version, `${instance.version}.jar`)

    if (!fs.existsSync(clientJar)) throw new Error('Client jar not found. Run instance setup first.')

    const separator = process.platform === 'win32' ? ';' : ':'
    const fullClasspath = `${clientJar}${separator}${classpath}`

    const assetsDir = path.join(gameDir, 'assets')
    const nativesDir = path.join(gameDir, 'versions', instance.version, 'natives')

    const maxMemory = instance.maxMemory || 4096
    const minMemory = instance.minMemory || 1024

    let authlibInjectorPath: string | undefined
    let authlibInjectorUrl: string | undefined
    if (account.type === 'discord') {
      authlibInjectorPath = await authlibService!.downloadAuthlibInjector()
      authlibInjectorUrl = account.authServer || 'https://auth.flexo.lol/authlib-injector'
    }

    const javaArgs = minecraftService!.buildJvmArgs(versionJson, {
      classpath: fullClasspath,
      gameDir,
      nativesDir,
      maxMemory,
      minMemory,
      javaPath: account.type === 'discord' ? 'java' : 'java',
      authlibInjectorPath,
      authlibInjectorUrl,
      jvmArgs: instance.jvmArgs,
    })

    const gameArgs = minecraftService!.buildGameArgs(versionJson, {
      username: account.playerName,
      uuid: account.playerUuid,
      accessToken: account.accessToken,
      userType: account.userType || 'mojang',
      gameDir,
      assetsDir: path.join(assetsDir),
      properties: account.properties,
    })

    const javaPath = await launcherService!.findJava()
    if (!javaPath) throw new Error('Java not found. Install Java or set path in Settings.')

    const { spawn } = await import('child_process')
    const proc = spawn(javaPath, [...javaArgs, versionJson.mainClassClient || versionJson.mainClass, ...gameArgs], {
      cwd: gameDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    proc.stdout?.on('data', (data: Buffer) => {
      sendToRenderer('launcher:game-log', { instanceId, stream: 'stdout', data: data.toString() })
    })
    proc.stderr?.on('data', (data: Buffer) => {
      sendToRenderer('launcher:game-log', { instanceId, stream: 'stderr', data: data.toString() })
    })
    proc.on('exit', (code) => {
      sendToRenderer('launcher:game-exited', { instanceId, code })
    })

    instanceStore!.setLastPlayed(instanceId)
    return { pid: proc.pid }
  })

  ipcMain.handle('launcher:get-java-path', () => launcherService!.findJava())
  ipcMain.handle('launcher:kill', (_e, instanceId: string) => { launcherService!.kill(instanceId); return true })

  // ── Downloads ──
  ipcMain.handle('downloads:create-job', (_e, id: string, label: string, tasks: any[]) => {
    return downloadManager!.createJob(id, label, tasks)
  })
  ipcMain.handle('downloads:start-job', async (_e, jobId: string) => {
    await downloadManager!.startJob(jobId)
  })
  ipcMain.handle('downloads:cancel-job', (_e, jobId: string) => { downloadManager!.cancelJob(jobId) })
  ipcMain.handle('downloads:get-job', (_e, jobId: string) => downloadManager!.getJob(jobId))
  ipcMain.handle('downloads:get-all-jobs', () => downloadManager!.getAllJobs())

  // ── Marketplace / Mods ──
  ipcMain.handle('marketplace:search', async (_e, query: string, filters?: any) => {
    return modrinthService!.searchMods(query, filters)
  })
  ipcMain.handle('marketplace:get-project', async (_e, projectId: string) => {
    return modrinthService!.getProject(projectId)
  })
  ipcMain.handle('marketplace:get-versions', async (_e, projectId: string, filters?: any) => {
    return modrinthService!.getProjectVersions(projectId, filters)
  })
  ipcMain.handle('marketplace:install-mod', async (_e, projectId: string, versionId: string, targetDir: string) => {
    const versions = await modrinthService!.getProjectVersions(projectId)
    const version = versions.find(v => v.id === versionId)
    if (!version) throw new Error('Version not found')
    return modrinthService!.downloadMod(version, targetDir)
  })

  // ── Modpacks ──
  ipcMain.handle('modpack:install', async (_e, modpackUrl: string, instanceDir: string, onProgress?: any) => {
    return modrinthService!.installModpack(modpackUrl, instanceDir, onProgress)
  })

  // ── Authlib ──
  ipcMain.handle('authlib:download', async () => {
    return authlibService!.downloadAuthlibInjector()
  })

  // ── Settings persistence ──
  ipcMain.handle('settings:get', () => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json')
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    }
    return {
      javaPath: '',
      maxMemory: 4096,
      minMemory: 1024,
      gameDirectory: path.join(app.getPath('userData'), 'instances'),
      jvmArgs: [],
    }
  })

  ipcMain.handle('settings:save', (_e, settings: any) => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json')
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    return true
  })

  // ── Updater ──
  ipcMain.handle('updater:check-for-updates', () => updaterService!.checkForUpdates())
  ipcMain.handle('updater:download-update', () => updaterService!.downloadUpdate())
  ipcMain.handle('updater:install-update', () => updaterService!.installUpdate())

  // ── App ──
  ipcMain.handle('app:get-info', () => ({
    version: app.getVersion(),
    name: app.getName(),
    isDev,
  }))
}

protocol.registerSchemesAsPrivileged([])

app.whenReady().then(() => {
  createWindow()
  initializeServices()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
