import { create } from 'zustand'
import { useDownloadStore } from './downloadStore'

export interface GameInstance {
  id: string
  name: string
  version: string
  versionId?: string
  modLoader: 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt'
  modLoaderVersion?: string
  gameDirectory: string
  javaPath?: string
  maxMemory?: number
  minMemory?: number
  jvmArgs?: string[]
  lastPlayed: number
  createdAt: number
  iconColor: string
  mods: any[]
}

interface InstanceState {
  instances: GameInstance[]
  isLoading: boolean
  setupProgress: Record<string, string>
  loadInstances: () => Promise<void>
  createInstance: (config: {
    name: string
    version: string
    modLoader?: string
    modLoaderVersion?: string
  }) => Promise<GameInstance>
  deleteInstance: (id: string) => Promise<void>
  setupInstance: (id: string) => Promise<void>
  launchInstance: (id: string) => Promise<void>
  recentlyPlayed: GameInstance | null
}

let downloadIdCounter = 0

export const useInstanceStore = create<InstanceState>((set, get) => ({
  instances: [],
  isLoading: false,
  recentlyPlayed: null,
  setupProgress: {},

  loadInstances: async () => {
    set({ isLoading: true })
    const instances = await window.electronAPI.instances.list()
    const recentlyPlayed = instances.find((i: GameInstance) => i.lastPlayed > 0) || null
    set({ instances, isLoading: false, recentlyPlayed })
  },

  createInstance: async (config) => {
    const instance = await window.electronAPI.instances.create(config)
    const instances = await window.electronAPI.instances.list()
    set({ instances })
    return instance
  },

  deleteInstance: async (id: string) => {
    await window.electronAPI.instances.delete(id)
    const instances = await window.electronAPI.instances.list()
    set({ instances })
  },

  setupInstance: async (id: string) => {
    const instance = get().instances.find(i => i.id === id)
    if (!instance) return

    const downloadId = `setup-${id}-${++downloadIdCounter}`

    const addDownload = useDownloadStore.getState().addDownload
    addDownload({
        id: downloadId,
        name: instance.name,
        version: instance.version,
        source: 'minecraft' as const,
        status: 'downloading' as const,
        progress: 0,
        speed: 0,
        eta: 0,
        instanceId: id,
        startedAt: Date.now(),
        type: 'instance-setup' as const,
      })

    set((state) => ({
      setupProgress: { ...state.setupProgress, [id]: 'Starting setup...' },
    }))

    const unsub = window.electronAPI.instance.onSetupProgress((data: any) => {
      if (data.instanceId === id) {
        set((state) => ({
          setupProgress: {
            ...state.setupProgress,
            [id]: data.step || 'Working...',
          },
        }))

        const updateDownload = useDownloadStore.getState().updateDownload
        if (updateDownload) {
          const progress = data.done ? 100 :
            data.step.includes('%') ? parseInt(data.step.match(/(\d+)%/)?.[1] || '50') :
            data.step.includes('complete') ? 100 : 30
          updateDownload(downloadId, {
            progress,
            status: data.done ? 'completed' : 'downloading',
          })
        }
      }
    })

    try {
      await window.electronAPI.instance.setup(id)
      set((state) => ({
        setupProgress: { ...state.setupProgress, [id]: 'Complete!' },
      }))

      const updateDownload = useDownloadStore.getState().updateDownload
      if (updateDownload) {
        updateDownload(downloadId, {
          status: 'completed',
          progress: 100,
          completedAt: Date.now(),
        })
      }
    } catch (err: any) {
      set((state) => ({
        setupProgress: { ...state.setupProgress, [id]: `Error: ${err.message}` },
      }))

      const updateDownload = useDownloadStore.getState().updateDownload
      if (updateDownload) {
        updateDownload(downloadId, {
          status: 'failed',
          error: err.message,
          completedAt: Date.now(),
        })
      }

      throw err
    } finally {
      unsub()
    }
  },

  launchInstance: async (id: string) => {
    await window.electronAPI.instances.setLastPlayed(id)
    await window.electronAPI.launcher.launch(id)
    const instances = await window.electronAPI.instances.list()
    set({ instances })
  },
}))
