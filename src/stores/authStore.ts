import { create } from 'zustand'

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
