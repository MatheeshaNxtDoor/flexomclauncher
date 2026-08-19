import { useState, useEffect, useCallback } from 'react'
import { ServerEntry, ServerPingInfo, useServerStore } from '../stores/serverStore'
import { useInstanceStore, GameInstance } from '../stores/instanceStore'
import AddServerModal from './AddServerModal'
import ServerPlayModal from './ServerPlayModal'

export default function QuickplayServers() {
  const { servers, loadServers, pingServer, removeServer, updateServer } = useServerStore()
  const { instances, loadInstances, launchInstance, setupInstance, setupProgress, runningInstances, setInstanceRunning, killInstance } = useInstanceStore()
  const [showAdd, setShowAdd] = useState(false)
  const [playingServer, setPlayingServer] = useState<ServerEntry | null>(null)
  const [pingCache, setPingCache] = useState<Record<string, ServerPingInfo>>({})
  const [expandedServer, setExpandedServer] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    loadServers()
    loadInstances()
  }, [])

  useEffect(() => {
    const unsubExited = window.electronAPI.launcher.onGameExited((data: any) => {
      setInstanceRunning(data.instanceId, false)
    })
    const unsubError = window.electronAPI.launcher.onGameError?.((data: any) => {
      setInstanceRunning(data.instanceId, false)
    })
    return () => { unsubExited(); unsubError?.() }
  }, [setInstanceRunning])

  const refreshPings = useCallback(async () => {
    const newCache: Record<string, ServerPingInfo> = {}
    for (const server of servers) {
      try {
        newCache[server.id] = await pingServer(server.address)
      } catch {}
    }
    setPingCache(newCache)
  }, [servers])

  useEffect(() => {
    if (servers.length > 0) {
      refreshPings()
      const interval = setInterval(refreshPings, 60000)
      return () => clearInterval(interval)
    }
  }, [servers, refreshPings])

  const handlePlay = async (server: ServerEntry) => {
    if (server.instanceId) {
      const instance = instances.find(i => i.id === server.instanceId)
      if (instance) {
        if (runningInstances[server.instanceId]) {
          try {
            await killInstance(server.instanceId)
          } catch (err: any) {
            alert(`Stop failed: ${err.message}`)
          }
          return
        }
        try {
          await launchInstance(server.instanceId)
        } catch (err: any) {
          alert(`Launch failed: ${err.message}`)
        }
        return
      }
    }
    setPlayingServer(server)
  }

  const handleRemove = async (id: string) => {
    await removeServer(id)
    setShowMenu(null)
  }

  return (
    <>
      <div className="px-3 mb-2">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-surface-500 hover:text-surface-300 transition-colors"
        >
          <span>Quickplay Servers</span>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setShowAdd(true) }}
              className="w-4 h-4 rounded flex items-center justify-center hover:bg-surface-700 text-surface-500 hover:text-surface-300 transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </button>
      </div>

      {!isCollapsed && (
        <div className="px-3 mb-3 space-y-1.5">
          {servers.length === 0 ? (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full p-3 rounded-lg border border-dashed border-surface-700 hover:border-surface-600 text-surface-500 hover:text-surface-400 text-xs text-center transition-colors"
            >
              + Add your first server
            </button>
          ) : (
            servers.map(server => {
              const ping = pingCache[server.id]
              const isExpanded = expandedServer === server.id
              const instance = instances.find(i => i.id === server.instanceId)
              const isRunning = server.instanceId ? runningInstances[server.instanceId] : false

              return (
                <div
                  key={server.id}
                  className={`group relative bg-surface-800/30 border rounded-lg overflow-hidden transition-all ${
                    isRunning ? 'border-red-500/30 bg-red-500/5' : 'border-surface-700/50 hover:border-surface-600/50'
                  }`}
                >
                  <button
                    onClick={() => handlePlay(server)}
                    className="w-full flex items-center gap-2.5 p-2 text-left"
                  >
                    {ping?.icon ? (
                      <img src={ping.icon} alt="" className="w-8 h-8 rounded-md shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-md bg-surface-700/50 flex items-center justify-center shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-500">
                          <rect x="2" y="2" width="20" height="20" rx="5"/>
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{server.name}</p>
                      {ping ? (
                        <div className="flex items-center gap-1.5">
                          {isRunning ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse" />
                              <span className="text-[10px] text-red-400">Playing</span>
                            </>
                          ) : ping.online ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                              <span className="text-[10px] text-surface-500 truncate">
                                {ping.players.online}/{ping.players.max}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                              <span className="text-[10px] text-surface-500">Offline</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-surface-500">Pinging...</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isRunning ? (
                        <div className="w-6 h-6 rounded flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-red-400">
                            <rect x="6" y="4" width="4" height="16"/>
                            <rect x="14" y="4" width="4" height="16"/>
                          </svg>
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-surface-400">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(showMenu === server.id ? null : server.id) }}
                        className="w-5 h-5 rounded flex items-center justify-center text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="2"/>
                          <circle cx="12" cy="12" r="2"/>
                          <circle cx="12" cy="19" r="2"/>
                        </svg>
                      </button>
                    </div>
                  </button>

                  {/* Server context menu */}
                  {showMenu === server.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMenu(null)} />
                      <div className="absolute right-2 top-full mt-1 w-40 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-50 overflow-hidden">
                        {instance && (
                          <div className="px-3 py-1.5 text-[10px] text-surface-500 border-b border-surface-700">
                            Assigned: {instance.name}
                          </div>
                        )}
                        <button
                          onClick={() => { setPlayingServer(server); setShowMenu(null) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-surface-700"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                          Play on...
                        </button>
                        <button
                          onClick={() => { handleRemove(server.id) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                          Remove
                        </button>
                      </div>
                    </>
                  )}

                  {/* MOTD tooltip */}
                  {ping?.online && ping.motdClean && (
                    <div className="px-2.5 pb-2 -mt-1">
                      <p className="text-[10px] text-surface-500 truncate italic" title={ping.motdClean}>
                        {ping.motdClean}
                      </p>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {showAdd && <AddServerModal onClose={() => setShowAdd(false)} />}
      {playingServer && <ServerPlayModal server={playingServer} onClose={() => setPlayingServer(null)} />}
    </>
  )
}
