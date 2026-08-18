import { create } from 'zustand'

export interface DownloadItem {
  id: string
  name: string
  version: string
  source: 'modrinth' | 'curseforge' | 'minecraft'
  status: 'queued' | 'downloading' | 'installing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  speed: number
  eta: number
  instanceId: string
  startedAt: number
  completedAt?: number
  error?: string
  type: 'mod' | 'modpack' | 'instance-setup' | 'asset' | 'library'
}

interface DownloadState {
  downloads: DownloadItem[]
  activeDownload: DownloadItem | null
  _listenersSetup: boolean
  addDownload: (item: DownloadItem) => void
  updateDownload: (id: string, updates: Partial<DownloadItem>) => void
  removeDownload: (id: string) => void
  clearCompleted: () => void
  setupDownloadProgress: (instanceId: string, step: string) => void
  setupListeners: () => void
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloads: [],
  activeDownload: null,
  _listenersSetup: false,

  addDownload: (item) => {
    set((state) => ({
      downloads: [...state.downloads, item],
      activeDownload: state.activeDownload || item,
    }))
  },

  updateDownload: (id, updates) => {
    set((state) => {
      const downloads = state.downloads.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      )
      const activeDownload = downloads.find(
        (d) => d.status === 'downloading' || d.status === 'queued'
      ) || null
      return { downloads, activeDownload }
    })
  },

  removeDownload: (id) => {
    set((state) => ({
      downloads: state.downloads.filter((d) => d.id !== id),
    }))
  },

  clearCompleted: () => {
    set((state) => ({
      downloads: state.downloads.filter((d) => d.status !== 'completed'),
    }))
  },

  setupDownloadProgress: (instanceId: string, step: string) => {
    const item = get().downloads.find(d => d.instanceId === instanceId && d.type === 'instance-setup')
    if (item) {
      get().updateDownload(item.id, { progress: 50, status: 'downloading' })
    }
  },

  setupListeners: () => {
    const state = get()
    if (state._listenersSetup) return
    set({ _listenersSetup: true })

    window.electronAPI.downloads.onJobProgress((data) => {
      const items = get().downloads.filter(d => d.id.startsWith(data.jobId))
      items.forEach(item => {
        get().updateDownload(item.id, {
          progress: data.percent,
          speed: data.speed || 0,
        })
      })
    })

    window.electronAPI.downloads.onJobCompleted((data) => {
      const items = get().downloads.filter(d => d.id.startsWith(data.jobId))
      items.forEach(item => {
        get().updateDownload(item.id, {
          status: data.status === 'completed' ? 'completed' : 'failed',
          progress: 100,
          completedAt: Date.now(),
          error: data.failedCount > 0 ? `${data.failedCount} files failed` : undefined,
        })
      })
    })

    window.electronAPI.downloads.onTaskProgress((data) => {
      const items = get().downloads.filter(d => d.id.startsWith(data.jobId))
      if (items.length > 0) {
        const jobProgress = (data.completed / data.total) * 100
        get().updateDownload(items[0].id, { progress: jobProgress })
      }
    })

    window.electronAPI.instance.onSetupProgress((data) => {
      const items = get().downloads.filter(d => d.instanceId === data.instanceId)
      items.forEach(item => {
        get().updateDownload(item.id, {
          progress: data.done ? 100 : 50,
          status: data.done ? 'completed' : 'downloading',
        })
      })
    })
  },
}))
