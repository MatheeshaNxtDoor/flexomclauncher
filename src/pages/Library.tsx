import { useEffect, useState } from 'react'
import { useInstanceStore, GameInstance } from '../stores/instanceStore'
import { useDownloadStore } from '../stores/downloadStore'
import CreateInstanceModal from '../components/CreateInstanceModal'

export default function Library() {
  const { instances, isLoading, loadInstances, recentlyPlayed, launchInstance, setupInstance, setupProgress } = useInstanceStore()
  const { setupListeners } = useDownloadStore()
  const [showCreate, setShowCreate] = useState(false)
  const [launching, setLaunching] = useState<string | null>(null)
  const [settingUp, setSettingUp] = useState<string | null>(null)

  useEffect(() => {
    loadInstances()
    setupListeners()
  }, [])

  const handleLaunch = async (id: string) => {
    setLaunching(id)
    try {
      await launchInstance(id)
    } catch (e: any) {
      alert(`Launch failed: ${e.message}`)
    } finally {
      setLaunching(null)
    }
  }

  const handleSetup = async (id: string) => {
    setSettingUp(id)
    try {
      await setupInstance(id)
    } catch (e: any) {
      alert(`Setup failed: ${e.message}`)
    } finally {
      setSettingUp(null)
    }
  }

  if (instances.length === 0 && !isLoading) {
    return (
      <>
        <EmptyState onOpenCreate={() => setShowCreate(true)} />
        {showCreate && <CreateInstanceModal onClose={() => setShowCreate(false)} />}
      </>
    )
  }

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Library</h1>
          <p className="text-sm text-surface-400 mt-1">{instances.length} instance{instances.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors shadow-lg shadow-flexo-500/20"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Instance
        </button>
      </div>

      {recentlyPlayed && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-surface-400 mb-3">Continue Playing</h2>
          <div className="relative rounded-xl overflow-hidden bg-surface-800/50 border border-surface-700/50">
            <div className="h-48 relative">
              <div className="absolute inset-0" style={{
                background: `linear-gradient(135deg, ${recentlyPlayed.iconColor}20, ${recentlyPlayed.iconColor}05)`
              }} />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-surface-900/60 to-transparent" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-flexo-500/20 text-flexo-400">
                    {recentlyPlayed.modLoader === 'vanilla' ? 'Vanilla' : recentlyPlayed.modLoader.charAt(0).toUpperCase() + recentlyPlayed.modLoader.slice(1)}
                  </span>
                  <span className="text-xs text-surface-500">{recentlyPlayed.version}</span>
                </div>
                <h3 className="text-xl font-bold text-white">{recentlyPlayed.name}</h3>
                <p className="text-xs text-surface-400 mt-1">
                  {recentlyPlayed.mods.length} mod{recentlyPlayed.mods.length !== 1 ? 's' : ''} installed
                </p>
              </div>
              <button
                onClick={() => handleLaunch(recentlyPlayed.id)}
                disabled={launching === recentlyPlayed.id || settingUp === recentlyPlayed.id}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white font-semibold transition-all disabled:opacity-50 shadow-lg shadow-flexo-500/25"
              >
                {launching === recentlyPlayed.id ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                )}
                {launching === recentlyPlayed.id ? 'Launching...' : 'Play'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-surface-400">All instances</h2>
          <span className="text-xs text-surface-500">Sorted by last played</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {instances.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              isLaunching={launching === instance.id}
              isSettingUp={settingUp === instance.id}
              setupStatus={setupProgress[instance.id]}
              onLaunch={() => handleLaunch(instance.id)}
              onSetup={() => handleSetup(instance.id)}
            />
          ))}
        </div>
      </div>

      {showCreate && <CreateInstanceModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function InstanceCard({
  instance,
  isLaunching,
  isSettingUp,
  setupStatus,
  onLaunch,
  onSetup,
}: {
  instance: GameInstance
  isLaunching: boolean
  isSettingUp: boolean
  setupStatus?: string
  onLaunch: () => void
  onSetup: () => void
}) {
  const { deleteInstance } = useInstanceStore()
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="group relative bg-surface-800/50 border border-surface-700/50 rounded-xl overflow-hidden hover:border-surface-600/50 transition-all duration-200">
      <div className="h-32 relative">
        <div className="absolute inset-0" style={{
          background: `linear-gradient(135deg, ${instance.iconColor}15, ${instance.iconColor}05)`
        }} />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-transparent to-transparent" />
        <div className="absolute top-3 left-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shadow-lg"
            style={{ backgroundColor: `${instance.iconColor}20`, color: instance.iconColor }}
          >
            {instance.name.charAt(0)}
          </div>
        </div>
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-7 h-7 rounded-md bg-surface-800/80 hover:bg-surface-700 flex items-center justify-center text-surface-400 hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="12" cy="19" r="2"/>
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-36 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      deleteInstance(instance.id)
                      setShowMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${instance.iconColor}20`, color: instance.iconColor }}
          >
            {instance.modLoader === 'vanilla' ? 'Vanilla' : instance.modLoader.charAt(0).toUpperCase() + instance.modLoader.slice(1)}
          </span>
          <span className="text-[10px] text-surface-500">{instance.version}</span>
        </div>
        <h3 className="text-sm font-semibold text-white truncate mb-1">{instance.name}</h3>
        <p className="text-[11px] text-surface-500 mb-3">
          {instance.mods.length} mod{instance.mods.length !== 1 ? 's' : ''}
          {instance.lastPlayed > 0 && (
            <> &middot; {formatTimeAgo(instance.lastPlayed)}</>
          )}
        </p>

        {isSettingUp ? (
          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-flexo-500/10 text-flexo-400 text-sm">
            <div className="w-4 h-4 border-2 border-flexo-400/30 border-t-flexo-400 rounded-full animate-spin" />
            <span className="truncate text-xs">{setupStatus || 'Setting up...'}</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onLaunch}
              disabled={isLaunching}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-flexo-500/10 hover:bg-flexo-500/20 text-flexo-400 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isLaunching ? (
                <div className="w-4 h-4 border-2 border-flexo-400/30 border-t-flexo-400 rounded-full animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              )}
              {isLaunching ? 'Launching...' : 'Play'}
            </button>
            <button
              onClick={onSetup}
              disabled={isSettingUp}
              className="px-3 py-2 rounded-lg bg-surface-700/50 hover:bg-surface-700 text-surface-400 text-sm transition-colors disabled:opacity-50"
              title="Re-download game files"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ onOpenCreate }: { onOpenCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in">
      <div className="w-20 h-20 rounded-2xl bg-surface-800/50 border border-surface-700/50 flex items-center justify-center mb-6">
        <div className="w-14 h-14 rounded-xl bg-flexo-500/10 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgb(34, 197, 94)" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
        </div>
      </div>

      <h2 className="text-xl font-bold text-white mb-2">No instances yet</h2>
      <p className="text-sm text-surface-400 text-center max-w-sm mb-6">
        Create your first Minecraft instance to get started. You can install mods, configure versions, and manage everything from here.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors shadow-lg shadow-flexo-500/20"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Instance
        </button>
      </div>
    </div>
  )
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
