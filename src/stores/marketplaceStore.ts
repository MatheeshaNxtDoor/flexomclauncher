import { create } from 'zustand'

export interface Mod {
  id: string
  slug: string
  title: string
  description: string
  author: string
  iconUrl: string
  downloads: number
  categories: string[]
  versions: string[]
  source: 'modrinth' | 'curseforge'
  dateModified: string
  license?: string
  body?: string
  clientSide?: string
  serverSide?: string
  projectType?: string
}

export type ProjectType = 'all' | 'mod' | 'modpack' | 'shader' | 'resourcepack' | 'datapack'

interface MarketplaceState {
  mods: Mod[]
  searchQuery: string
  selectedSource: 'all' | 'modrinth' | 'curseforge'
  selectedProjectType: ProjectType
  isLoading: boolean
  error: string | null
  searchMods: (query: string) => Promise<void>
  setSource: (source: 'all' | 'modrinth' | 'curseforge') => void
  setProjectType: (type: ProjectType) => void
  loadPopularMods: (projectType?: ProjectType) => Promise<void>
  installMod: (projectId: string, versionId: string, targetDir: string) => Promise<string>
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  mods: [],
  searchQuery: '',
  selectedSource: 'all',
  selectedProjectType: 'mod',
  isLoading: false,
  error: null,

  searchMods: async (query: string) => {
    const { selectedProjectType } = get()
    set({ isLoading: true, searchQuery: query, error: null })
    try {
      const filters: any = { limit: 20 }
      if (query) filters.query = query
      if (selectedProjectType !== 'all') filters.projectType = selectedProjectType

      const result = await window.electronAPI.marketplace.search(query || '', filters)
      const mods: Mod[] = (result.hits || []).map((hit: any) => ({
        id: hit.project_id,
        slug: hit.slug,
        title: hit.title,
        description: hit.description,
        author: hit.author,
        iconUrl: hit.icon_url,
        downloads: hit.downloads,
        categories: hit.categories || [],
        versions: hit.versions || [],
        source: 'modrinth' as const,
        dateModified: hit.date_modified,
        clientSide: hit.client_side,
        serverSide: hit.server_side,
        projectType: hit.project_type,
      }))
      set({ mods, isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
    }
  },

  setSource: (source) => set({ selectedSource: source }),
  setProjectType: (type) => set({ selectedProjectType: type }),

  loadPopularMods: async (projectType?: ProjectType) => {
    const type = projectType || get().selectedProjectType
    set({ isLoading: true, error: null })
    try {
      const filters: any = { limit: 20 }
      if (type !== 'all') filters.projectType = type

      const result = await window.electronAPI.marketplace.search('', filters)
      const mods: Mod[] = (result.hits || []).map((hit: any) => ({
        id: hit.project_id,
        slug: hit.slug,
        title: hit.title,
        description: hit.description,
        author: hit.author,
        iconUrl: hit.icon_url,
        downloads: hit.downloads,
        categories: hit.categories || [],
        versions: hit.versions || [],
        source: 'modrinth' as const,
        dateModified: hit.date_modified,
        clientSide: hit.client_side,
        serverSide: hit.server_side,
        projectType: hit.project_type,
      }))
      set({ mods, isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
    }
  },

  installMod: async (projectId: string, versionId: string, targetDir: string) => {
    return window.electronAPI.marketplace.installMod(projectId, versionId, targetDir)
  },
}))
