import { create } from 'zustand'

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
        delete: (instanceId: string) => Promise<boolean>
        setLastPlayed: (instanceId: string) => Promise<boolean>
        addMod: (instanceId: string, mod: any) => Promise<boolean>
        removeMod: (instanceId: string, modId: string) => Promise<boolean>
      }
      instance: {
        setup: (instanceId: string) => Promise<any>
        onSetupProgress: (callback: (data: any) => void) => () => void
      }
      launcher: {
        launch: (instanceId: string) => Promise<any>
        getJavaPath: () => Promise<string | null>
        kill: (instanceId: string) => Promise<boolean>
        onGameLog: (callback: (data: any) => void) => () => void
        onGameExited: (callback: (data: any) => void) => () => void
      }
      minecraft: {
        getVersionManifest: () => Promise<any>
        getVersionJson: (versionId: string) => Promise<any>
      }
      marketplace: {
        search: (query: string, filters?: any) => Promise<any>
        getProject: (projectId: string) => Promise<any>
        getVersions: (projectId: string, filters?: any) => Promise<any>
        installMod: (projectId: string, versionId: string, targetDir: string) => Promise<string>
      }
      modpack: {
        install: (url: string, instanceDir: string) => Promise<any>
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
        onDownloadProgress: (callback: (progress: any) => void) => () => void
        onUpdateDownloaded: (callback: () => void) => () => void
      }
      app: {
        getInfo: () => Promise<{ version: string; name: string; isDev: boolean }>
      }
    }
  }
}

export interface Account {
  id: string
  type: 'discord' | 'microsoft'
  playerName: string
  playerUuid: string
  accessToken: string
  clientToken: string
  refreshToken: string
  authServer: string
  userType: string
  properties: any[]
  lastPlayed: number
}

interface AuthState {
  isAuthenticated: boolean
  currentAccount: Account | null
  accounts: Account[]
  isLoading: boolean
  error: string | null
  login: () => Promise<void>
  loadAccounts: () => Promise<void>
  switchAccount: (id: string) => Promise<void>
  removeAccount: (id: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  currentAccount: null,
  accounts: [],
  isLoading: false,
  error: null,

  login: async () => {
    set({ isLoading: true, error: null })
    try {
      await window.electronAPI.auth.discordLogin()
      const accounts = await window.electronAPI.accounts.list()
      const current = await window.electronAPI.accounts.getCurrent()
      set({
        isAuthenticated: true,
        currentAccount: current,
        accounts,
        isLoading: false,
      })
    } catch (e: any) {
      set({ isLoading: false, error: e.message })
      throw e
    }
  },

  loadAccounts: async () => {
    const accounts = await window.electronAPI.accounts.list()
    const current = await window.electronAPI.accounts.getCurrent()
    set({
      accounts,
      currentAccount: current,
      isAuthenticated: !!current,
    })
  },

  switchAccount: async (id: string) => {
    await window.electronAPI.accounts.setCurrent(id)
    const current = await window.electronAPI.accounts.getCurrent()
    set({ currentAccount: current })
  },

  removeAccount: async (id: string) => {
    await window.electronAPI.accounts.remove(id)
    const accounts = await window.electronAPI.accounts.list()
    const current = await window.electronAPI.accounts.getCurrent()
    set({
      accounts,
      currentAccount: current,
      isAuthenticated: !!current,
    })
  },

  logout: () => {
    set({
      isAuthenticated: false,
      currentAccount: null,
      accounts: [],
    })
  },
}))
