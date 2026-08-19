declare global {
  interface Window {
    electronAPI: {
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
        update: (instanceId: string, updates: any) => Promise<boolean>
        delete: (instanceId: string) => Promise<boolean>
        setLastPlayed: (instanceId: string) => Promise<boolean>
        addMod: (instanceId: string, mod: any) => Promise<boolean>
        removeMod: (instanceId: string, modId: string) => Promise<boolean>
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
    }
  }
}

export {}
