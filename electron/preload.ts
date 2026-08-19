import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
  }
  auth: {
    discordLogin: () => Promise<any>
    discordRefresh: (accountId: string) => Promise<any>
  }
  accounts: {
    list: () => Promise<any[]>
    getCurrent: () => Promise<any>
    setCurrent: (accountId: string) => Promise<boolean>
    remove: (accountId: string) => Promise<boolean>
  }
  instances: {
    list: () => Promise<any[]>
    get: (instanceId: string) => Promise<any>
    create: (config: any) => Promise<any>
    delete: (instanceId: string) => Promise<boolean>
    setLastPlayed: (instanceId: string) => Promise<boolean>
    addMod: (instanceId: string, mod: any) => Promise<boolean>
    removeMod: (instanceId: string, modId: string) => Promise<boolean>
    update: (instanceId: string, updates: any) => Promise<boolean>
    isInstalled: (instanceId: string) => Promise<boolean>
    toggleMod: (instanceId: string, modId: string) => Promise<boolean>
    listContentFiles: (instanceId: string, contentType: string) => Promise<Array<{ filename: string; disabled: boolean }>>
    deleteModFile: (instanceId: string, contentType: string, filename: string) => Promise<boolean>
    toggleModFile: (instanceId: string, contentType: string, filename: string) => Promise<string | null>
  }
  instance: {
    setup: (instanceId: string) => Promise<any>
    onSetupProgress: (callback: (data: any) => void) => () => void
  }
  launcher: {
    launch: (instanceId: string) => Promise<any>
    getJavaPath: () => Promise<string | null>
    kill: (instanceId: string) => Promise<boolean>
    isRunning: (instanceId: string) => Promise<boolean>
    onGameLog: (callback: (data: any) => void) => () => void
    onGameExited: (callback: (data: any) => void) => () => void
    onGameError: (callback: (data: any) => void) => () => void
  }
  minecraft: {
    getVersionManifest: () => Promise<any>
    getVersionJson: (versionId: string) => Promise<any>
  }
  marketplace: {
    search: (query: string, filters?: any) => Promise<any>
    getProject: (projectId: string) => Promise<any>
    getVersions: (projectId: string, filters?: any) => Promise<any>
    getMultipleProjects: (projectIds: string[]) => Promise<any[]>
    getMultipleVersions: (versionIds: string[]) => Promise<any[]>
    installMod: (projectId: string, versionId: string, targetDir: string) => Promise<string>
    resolveDependencies: (versionId: string, gameVersion: string, loader: string) => Promise<any[]>
  }
  modpack: {
    install: (url: string, instanceDir: string) => Promise<any>
  }
  modloader: {
    install: (modLoader: string, gameVersion: string, gameDir: string, loaderVersion?: string) => Promise<any>
    getVersions: (modLoader: string, gameVersion: string) => Promise<string[]>
  }
  downloads: {
    createJob: (id: string, label: string, tasks: any[]) => Promise<any>
    startJob: (jobId: string) => Promise<void>
    cancelJob: (jobId: string) => Promise<void>
    getJob: (jobId: string) => Promise<any>
    getAllJobs: () => Promise<any[]>
    onJobProgress: (callback: (data: any) => void) => () => void
    onJobCompleted: (callback: (data: any) => void) => () => void
    onTaskProgress: (callback: (data: any) => void) => () => void
  }
  settings: {
    get: () => Promise<any>
    save: (settings: any) => Promise<boolean>
  }
  updater: {
    checkForUpdates: () => Promise<any>
    downloadUpdate: () => Promise<void>
    installUpdate: () => Promise<void>
    onUpdateAvailable: (callback: (info: any) => void) => () => void
    onUpdateNotAvailable: (callback: () => void) => () => void
    onDownloadProgress: (callback: (progress: any) => void) => () => void
    onUpdateDownloaded: (callback: () => void) => () => void
    onError: (callback: (msg: string) => void) => () => void
  }
  app: {
    getInfo: () => Promise<{ version: string; name: string; isDev: boolean }>
  }
  servers: {
    list: () => Promise<any[]>
    add: (config: any) => Promise<any>
    update: (id: string, updates: any) => Promise<boolean>
    remove: (id: string) => Promise<boolean>
    setLastPlayed: (id: string) => Promise<boolean>
    ping: (address: string) => Promise<any>
  }
  import: {
    scan: (dir?: string) => Promise<any[]>
    getSuggestions: () => Promise<string[]>
    addInstance: (config: any) => Promise<any>
  }
}

function onEvent(channel: string, callback: (...args: any[]) => void) {
  const handler = (_event: any, ...args: any[]) => callback(...args)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const electronAPI: ElectronAPI = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  auth: {
    discordLogin: () => ipcRenderer.invoke('auth:discord-login'),
    discordRefresh: (accountId: string) => ipcRenderer.invoke('auth:discord-refresh', accountId),
  },
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    getCurrent: () => ipcRenderer.invoke('accounts:get-current'),
    setCurrent: (accountId: string) => ipcRenderer.invoke('accounts:set-current', accountId),
    remove: (accountId: string) => ipcRenderer.invoke('accounts:remove', accountId),
  },
  instances: {
    list: () => ipcRenderer.invoke('instances:list'),
    get: (instanceId: string) => ipcRenderer.invoke('instances:get', instanceId),
    create: (config: any) => ipcRenderer.invoke('instances:create', config),
    delete: (instanceId: string) => ipcRenderer.invoke('instances:delete', instanceId),
    setLastPlayed: (instanceId: string) => ipcRenderer.invoke('instances:set-last-played', instanceId),
    addMod: (instanceId: string, mod: any) => ipcRenderer.invoke('instances:add-mod', instanceId, mod),
    removeMod: (instanceId: string, modId: string) => ipcRenderer.invoke('instances:remove-mod', instanceId, modId),
    update: (instanceId: string, updates: any) => ipcRenderer.invoke('instances:update', instanceId, updates),
    isInstalled: (instanceId: string) => ipcRenderer.invoke('instances:is-installed', instanceId),
    toggleMod: (instanceId: string, modId: string) => ipcRenderer.invoke('instances:toggle-mod', instanceId, modId),
    listContentFiles: (instanceId: string, contentType: string) => ipcRenderer.invoke('instances:list-content-files', instanceId, contentType),
    deleteModFile: (instanceId: string, contentType: string, filename: string) => ipcRenderer.invoke('instances:delete-mod-file', instanceId, contentType, filename),
    toggleModFile: (instanceId: string, contentType: string, filename: string) => ipcRenderer.invoke('instances:toggle-mod-file', instanceId, contentType, filename),
  },
  instance: {
    setup: (instanceId: string) => ipcRenderer.invoke('instance:setup', instanceId),
    onSetupProgress: (callback) => onEvent('instance:setup-progress', callback),
  },
  launcher: {
    launch: (instanceId: string) => ipcRenderer.invoke('launcher:launch', instanceId),
    getJavaPath: () => ipcRenderer.invoke('launcher:get-java-path'),
    kill: (instanceId: string) => ipcRenderer.invoke('launcher:kill', instanceId),
    isRunning: (instanceId: string) => ipcRenderer.invoke('launcher:is-running', instanceId),
    onGameLog: (callback) => onEvent('launcher:game-log', callback),
    onGameExited: (callback) => onEvent('launcher:game-exited', callback),
    onGameError: (callback) => onEvent('launcher:game-error', callback),
  },
  minecraft: {
    getVersionManifest: () => ipcRenderer.invoke('minecraft:get-version-manifest'),
    getVersionJson: (versionId: string) => ipcRenderer.invoke('minecraft:get-version-json', versionId),
  },
  marketplace: {
    search: (query: string, filters?: any) => ipcRenderer.invoke('marketplace:search', query, filters),
    getProject: (projectId: string) => ipcRenderer.invoke('marketplace:get-project', projectId),
    getVersions: (projectId: string, filters?: any) => ipcRenderer.invoke('marketplace:get-versions', projectId, filters),
    getMultipleProjects: (projectIds: string[]) => ipcRenderer.invoke('marketplace:get-multiple-projects', projectIds),
    getMultipleVersions: (versionIds: string[]) => ipcRenderer.invoke('marketplace:get-multiple-versions', versionIds),
    installMod: (projectId: string, versionId: string, targetDir: string) => ipcRenderer.invoke('marketplace:install-mod', projectId, versionId, targetDir),
    resolveDependencies: (versionId: string, gameVersion: string, loader: string) => ipcRenderer.invoke('marketplace:resolve-dependencies', versionId, gameVersion, loader),
  },
  modpack: {
    install: (url: string, instanceDir: string) => ipcRenderer.invoke('modpack:install', url, instanceDir),
  },
  modloader: {
    install: (modLoader: string, gameVersion: string, gameDir: string, loaderVersion?: string) => ipcRenderer.invoke('modloader:install', modLoader, gameVersion, gameDir, loaderVersion),
    getVersions: (modLoader: string, gameVersion: string) => ipcRenderer.invoke('modloader:get-versions', modLoader, gameVersion),
  },
  downloads: {
    createJob: (id: string, label: string, tasks: any[]) => ipcRenderer.invoke('downloads:create-job', id, label, tasks),
    startJob: (jobId: string) => ipcRenderer.invoke('downloads:start-job', jobId),
    cancelJob: (jobId: string) => ipcRenderer.invoke('downloads:cancel-job', jobId),
    getJob: (jobId: string) => ipcRenderer.invoke('downloads:get-job', jobId),
    getAllJobs: () => ipcRenderer.invoke('downloads:get-all-jobs'),
    onJobProgress: (callback) => onEvent('download:job-progress', callback),
    onJobCompleted: (callback) => onEvent('download:job-completed', callback),
    onTaskProgress: (callback) => onEvent('download:task-progress', callback),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings: any) => ipcRenderer.invoke('settings:save', settings),
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download-update'),
    installUpdate: () => ipcRenderer.invoke('updater:install-update'),
    onUpdateAvailable: (callback) => onEvent('updater:update-available', callback),
    onUpdateNotAvailable: (callback) => onEvent('updater:update-not-available', callback),
    onDownloadProgress: (callback) => onEvent('updater:download-progress', callback),
    onUpdateDownloaded: (callback) => onEvent('updater:update-downloaded', callback),
    onError: (callback) => onEvent('updater:error', callback),
  },
  app: {
    getInfo: () => ipcRenderer.invoke('app:get-info'),
  },
  servers: {
    list: () => ipcRenderer.invoke('servers:list'),
    add: (config: any) => ipcRenderer.invoke('servers:add', config),
    update: (id: string, updates: any) => ipcRenderer.invoke('servers:update', id, updates),
    remove: (id: string) => ipcRenderer.invoke('servers:remove', id),
    setLastPlayed: (id: string) => ipcRenderer.invoke('servers:set-last-played', id),
    ping: (address: string) => ipcRenderer.invoke('servers:ping', address),
  },
  import: {
    scan: (dir?: string) => ipcRenderer.invoke('import:scan', dir),
    getSuggestions: () => ipcRenderer.invoke('import:get-suggestions'),
    addInstance: (config: any) => ipcRenderer.invoke('import:add-instance', config),
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
