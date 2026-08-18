import { useEffect, useState } from 'react'
import { useMarketplaceStore, Mod, ProjectType } from '../stores/marketplaceStore'
import ModDetailModal from '../components/ModDetailModal'
import ModpackInstallModal from '../components/ModpackInstallModal'

const PROJECT_TYPES: { id: ProjectType; label: string; icon: string }[] = [
  { id: 'mod', label: 'Mods', icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' },
  { id: 'modpack', label: 'Modpacks', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { id: 'shader', label: 'Shaders', icon: 'M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83' },
  { id: 'resourcepack', label: 'Resource Packs', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { id: 'datapack', label: 'Datapacks', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
]

export default function Marketplace() {
  const { mods, isLoading, searchMods, selectedProjectType, loadPopularMods } = useMarketplaceStore()
  const [query, setQuery] = useState('')
  const [selectedMod, setSelectedMod] = useState<Mod | null>(null)
  const [selectedModpack, setSelectedModpack] = useState<Mod | null>(null)
  const [projectType, setProjectType] = useState<ProjectType>('mod')

  useEffect(() => {
    loadPopularMods(projectType)
  }, [projectType])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      searchMods(query)
    } else {
      loadPopularMods(projectType)
    }
  }

  const handleTypeChange = (type: ProjectType) => {
    setProjectType(type)
    useMarketplaceStore.getState().setProjectType(type)
    if (query.trim()) {
      searchMods(query)
    } else {
      loadPopularMods(type)
    }
  }

  const handleModClick = (mod: Mod) => {
    if (mod.projectType === 'modpack') {
      setSelectedModpack(mod)
    } else {
      setSelectedMod(mod)
    }
  }

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketplace</h1>
          <p className="text-sm text-surface-400 mt-1">Browse and install content from Modrinth</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${PROJECT_TYPES.find(t => t.id === projectType)?.label || 'content'}...`}
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-800/50 border border-surface-700/50 text-white text-sm placeholder-surface-500 focus:outline-none focus:border-flexo-500/50 focus:ring-1 focus:ring-flexo-500/20 transition-all"
          />
        </div>
      </form>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {PROJECT_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => handleTypeChange(type.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              projectType === type.id
                ? 'bg-flexo-500 text-white shadow-lg shadow-flexo-500/20'
                : 'bg-surface-800/50 text-surface-400 border border-surface-700/50 hover:text-surface-200 hover:bg-surface-800/80'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={type.icon} />
            </svg>
            {type.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-surface-800/30 rounded-xl border border-surface-700/30 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-surface-700/50" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-surface-700/50 rounded mb-2" />
                  <div className="h-3 w-48 bg-surface-700/30 rounded" />
                </div>
              </div>
              <div className="mt-3 h-16 bg-surface-700/20 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {mods.map((mod) => (
            <button
              key={mod.id}
              onClick={() => handleModClick(mod)}
              className="group text-left bg-surface-800/30 hover:bg-surface-800/60 border border-surface-700/30 hover:border-surface-700/60 rounded-xl p-4 transition-all duration-200"
            >
              <div className="flex gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg bg-surface-700/50 overflow-hidden shrink-0">
                  {mod.iconUrl ? (
                    <img src={mod.iconUrl} alt={mod.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-surface-500">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-white truncate group-hover:text-flexo-400 transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-surface-500 truncate">by {mod.author}</p>
                </div>
              </div>

              <p className="text-xs text-surface-400 line-clamp-2 mb-3 min-h-[2.5rem]">
                {mod.description}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-flexo-500/10 text-flexo-400 capitalize">
                  {mod.projectType || 'mod'}
                </span>
                {mod.categories.slice(0, 2).map((cat) => (
                  <span key={cat} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/50 text-surface-400">
                    {cat}
                  </span>
                ))}
                <span className="text-[10px] text-surface-500 ml-auto">
                  {formatDownloads(mod.downloads)} downloads
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!isLoading && mods.length === 0 && (
        <div className="text-center py-16">
          <p className="text-surface-500 text-sm">No results found. Try a different search.</p>
        </div>
      )}

      {selectedMod && (
        <ModDetailModal mod={selectedMod} onClose={() => setSelectedMod(null)} />
      )}

      {selectedModpack && (
        <ModpackInstallModal mod={selectedModpack} onClose={() => setSelectedModpack(null)} />
      )}
    </div>
  )
}

function formatDownloads(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}
