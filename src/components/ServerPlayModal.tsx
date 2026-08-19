import { useState, useEffect } from 'react'
import { ServerEntry, ServerPingInfo, useServerStore } from '../stores/serverStore'
import { GameInstance, useInstanceStore } from '../stores/instanceStore'

interface Props {
  server: ServerEntry
  onClose: () => void
}

export default function ServerPlayModal({ server, onClose }: Props) {
  const { instances, loadInstances, setupInstance, launchInstance, setupProgress } = useInstanceStore()
  const { setLastPlayed } = useServerStore()
  const [selectedInstanceId, setSelectedInstanceId] = useState(server.instanceId || '')
  const [pingResult, setPingResult] = useState<ServerPingInfo | null>(null)
  const [isPinging, setIsPinging] = useState(true)
  const [isLaunching, setIsLaunching] = useState(false)
  const [settingUp, setSettingUp] = useState<string | null>(null)
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadInstances()
    doPing()
  }, [])

  useEffect(() => {
    const check = async () => {
      const map: Record<string, boolean> = {}
      for (const inst of instances) {
        map[inst.id] = await window.electronAPI.instances.isInstalled(inst.id)
      }
      setInstalledMap(map)
    }
    if (instances.length > 0) check()
  }, [instances])

  const doPing = async () => {
    setIsPinging(true)
    try {
      const result = await window.electronAPI.servers.ping(server.address)
      setPingResult(result)
    } catch {}
    setIsPinging(false)
  }

  const selectedInstance = instances.find(i => i.id === selectedInstanceId)

  const handlePlay = async () => {
    if (!selectedInstanceId) return
    setIsLaunching(true)
    try {
      if (!installedMap[selectedInstanceId]) {
        setSettingUp(selectedInstanceId)
        await setupInstance(selectedInstanceId)
        setSettingUp(null)
      }
      await setLastPlayed(server.id)
      await launchInstance(selectedInstanceId)
      onClose()
    } catch (err: any) {
      alert(`Failed: ${err.message}`)
      setSettingUp(null)
    } finally {
      setIsLaunching(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface-900 border border-surface-700/50 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="px-6 py-4 border-b border-surface-700/50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Play on Server</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-surface-800 hover:bg-surface-700 flex items-center justify-center text-surface-400 hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Server Info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-800/50 border border-surface-700/50">
            {pingResult?.icon ? (
              <img src={pingResult.icon} alt="Server icon" className="w-12 h-12 rounded-lg" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-surface-700 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-400">
                  <rect x="2" y="2" width="20" height="20" rx="5"/>
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{server.name}</p>
              <p className="text-xs text-surface-400 truncate">{server.address}</p>
              {isPinging ? (
                <p className="text-[10px] text-surface-500">Pinging...</p>
              ) : pingResult?.online ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-green-400">Online</span>
                  <span className="text-[10px] text-surface-500">
                    {pingResult.players.online}/{pingResult.players.max}
                  </span>
                  <span className="text-[10px] text-surface-500">{pingResult.latency}ms</span>
                </div>
              ) : (
                <p className="text-[10px] text-red-400">Offline</p>
              )}
            </div>
          </div>

          {/* Instance Selection */}
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Choose Instance</label>
            {instances.length === 0 ? (
              <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/50 text-center">
                <p className="text-xs text-surface-400">No instances available</p>
                <p className="text-[10px] text-surface-500 mt-1">Create an instance first to play on servers</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {instances.map((inst) => {
                  const isInstalled = installedMap[inst.id] ?? false
                  const isSelected = selectedInstanceId === inst.id
                  const isLoading = settingUp === inst.id

                  return (
                    <button
                      key={inst.id}
                      onClick={() => setSelectedInstanceId(inst.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                        isSelected
                          ? 'bg-flexo-500/10 border-flexo-500/30'
                          : 'bg-surface-800/30 border-surface-700/50 hover:border-surface-600/50'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ backgroundColor: `${inst.iconColor}20`, color: inst.iconColor }}
                      >
                        {inst.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{inst.name}</p>
                        <p className="text-[10px] text-surface-500">
                          {inst.version} &middot; {inst.modLoader === 'vanilla' ? 'Vanilla' : inst.modLoader.charAt(0).toUpperCase() + inst.modLoader.slice(1)}
                          {!isInstalled && ' &middot; Not installed'}
                        </p>
                      </div>
                      {isSelected && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-flexo-400 shrink-0">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-surface-700/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-300 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePlay}
            disabled={!selectedInstanceId || isLaunching || settingUp !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {(isLaunching || settingUp) && (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {settingUp ? 'Installing...' : isLaunching ? 'Launching...' : 'Play'}
          </button>
        </div>
      </div>
    </div>
  )
}
