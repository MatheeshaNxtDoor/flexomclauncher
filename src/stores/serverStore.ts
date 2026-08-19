import { create } from 'zustand'

export interface ServerEntry {
  id: string
  name: string
  address: string
  instanceId?: string
  lastPlayed: number
  createdAt: number
  order: number
}

export interface ServerPingInfo {
  online: boolean
  motd: string
  motdClean: string
  version: string
  players: { online: number; max: number }
  icon: string | null
  latency: number
}

interface ServerState {
  servers: ServerEntry[]
  pingCache: Record<string, ServerPingInfo>
  isLoading: boolean
  loadServers: () => Promise<void>
  addServer: (config: { name: string; address: string; instanceId?: string }) => Promise<ServerEntry>
  updateServer: (id: string, updates: Partial<Pick<ServerEntry, 'name' | 'address' | 'instanceId'>>) => Promise<void>
  removeServer: (id: string) => Promise<void>
  pingServer: (address: string) => Promise<ServerPingInfo>
  setLastPlayed: (id: string) => Promise<void>
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  pingCache: {},
  isLoading: false,

  loadServers: async () => {
    set({ isLoading: true })
    const servers = await window.electronAPI.servers.list()
    set({ servers, isLoading: false })
  },

  addServer: async (config) => {
    const server = await window.electronAPI.servers.add(config)
    const servers = await window.electronAPI.servers.list()
    set({ servers })
    return server
  },

  updateServer: async (id, updates) => {
    await window.electronAPI.servers.update(id, updates)
    const servers = await window.electronAPI.servers.list()
    set({ servers })
  },

  removeServer: async (id) => {
    await window.electronAPI.servers.remove(id)
    const servers = await window.electronAPI.servers.list()
    set((state) => {
      const newCache = { ...state.pingCache }
      delete newCache[id]
      return { servers, pingCache: newCache }
    })
  },

  pingServer: async (address) => {
    const result = await window.electronAPI.servers.ping(address)
    return result
  },

  setLastPlayed: async (id) => {
    await window.electronAPI.servers.setLastPlayed(id)
    const servers = await window.electronAPI.servers.list()
    set({ servers })
  },
}))
