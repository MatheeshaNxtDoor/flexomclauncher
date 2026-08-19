import { useState } from 'react'
import { useServerStore, ServerPingInfo } from '../stores/serverStore'
import { useInstanceStore } from '../stores/instanceStore'

interface Props {
  onClose: () => void
}

export default function AddServerModal({ onClose }: Props) {
  const { addServer, pingServer } = useServerStore()
  const { instances } = useInstanceStore()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [instanceId, setInstanceId] = useState('')
  const [pingResult, setPingResult] = useState<ServerPingInfo | null>(null)
  const [isPinging, setIsPinging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [pingAttempted, setPingAttempted] = useState(false)

  const handlePing = async () => {
    if (!address.trim()) return
    setIsPinging(true)
    setPingAttempted(true)
    setError('')
    setPingResult(null)
    try {
      const result = await pingServer(address.trim())
      setPingResult(result)
      if (!result.online) {
        setError('Server is offline or unreachable')
      } else if (!name.trim()) {
        setName(address.split(':')[0])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to ping server')
    } finally {
      setIsPinging(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim() || !address.trim()) return
    setIsSaving(true)
    try {
      await addServer({
        name: name.trim(),
        address: address.trim(),
        instanceId: instanceId || undefined,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save server')
    } finally {
      setIsSaving(false)
    }
  }

  const canSave = name.trim() && address.trim() && !isSaving

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface-900 border border-surface-700/50 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="px-6 py-4 border-b border-surface-700/50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Add Server</h2>
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
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Server Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hypixel"
              className="w-full h-10 px-3 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm focus:outline-none focus:border-flexo-500/50 placeholder:text-surface-500"
            />
          </div>

          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Server Address</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePing()}
                placeholder="e.g. play.hypixel.net:25565"
                className="flex-1 h-10 px-3 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm focus:outline-none focus:border-flexo-500/50 placeholder:text-surface-500"
              />
              <button
                onClick={handlePing}
                disabled={isPinging || !address.trim()}
                className="px-3 h-10 rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-300 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isPinging ? (
                  <div className="w-3.5 h-3.5 border-2 border-surface-500 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                )}
                Ping
              </button>
            </div>
          </div>

          {/* Ping Result */}
          {pingAttempted && (
            <div className={`p-3 rounded-lg border ${
              pingResult?.online
                ? 'bg-green-500/5 border-green-500/20'
                : 'bg-red-500/5 border-red-500/20'
            }`}>
              {pingResult?.online ? (
                <div className="flex items-start gap-3">
                  {pingResult.icon ? (
                    <img src={pingResult.icon} alt="Server icon" className="w-10 h-10 rounded-lg" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-surface-700 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-400">
                        <rect x="2" y="2" width="20" height="20" rx="5"/>
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-400">Online</p>
                    {pingResult.motdClean && (
                      <p className="text-xs text-surface-300 truncate mt-0.5">{pingResult.motdClean}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-surface-500">
                        {pingResult.version}
                      </span>
                      <span className="text-[10px] text-surface-500">
                        {pingResult.players.online}/{pingResult.players.max} players
                      </span>
                      <span className="text-[10px] text-surface-500">
                        {pingResult.latency}ms
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-red-400">{error || 'Server is offline or unreachable'}</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Assign to Instance (optional)</label>
            <select
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm focus:outline-none focus:border-flexo-500/50"
            >
              <option value="">No instance assigned</option>
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.version})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-surface-500 mt-1">
              {instanceId ? 'This server will auto-launch with this instance' : 'You can choose an instance when you play'}
            </p>
          </div>

          {error && !pingAttempted && (
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-surface-700/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-300 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Adding...' : 'Add Server'}
          </button>
        </div>
      </div>
    </div>
  )
}
