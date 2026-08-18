import { useState } from 'react'
import { useInstanceStore } from '../stores/instanceStore'

const MINECRAFT_VERSIONS = [
  '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.20',
  '1.19.4', '1.19.2', '1.18.2',
]

const MOD_LOADERS = [
  { id: 'vanilla', label: 'Vanilla', description: 'No mod loader' },
  { id: 'fabric', label: 'Fabric', description: 'Lightweight mod loader' },
  { id: 'forge', label: 'Forge', description: 'Traditional mod loader' },
  { id: 'neoforge', label: 'NeoForge', description: 'Community fork of Forge' },
  { id: 'quilt', label: 'Quilt', description: 'Fabric-based mod loader' },
]

export default function CreateInstanceModal({ onClose }: { onClose: () => void }) {
  const { createInstance, setupInstance } = useInstanceStore()
  const [name, setName] = useState('')
  const [version, setVersion] = useState('1.21.4')
  const [modLoader, setModLoader] = useState('vanilla')
  const [isCreating, setIsCreating] = useState(false)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [setupStatus, setSetupStatus] = useState('')
  const [step, setStep] = useState<'name' | 'version' | 'loader'>('name')

  const handleCreate = async () => {
    if (!name.trim()) return
    setIsCreating(true)
    try {
      const instance = await createInstance({
        name: name.trim(),
        version,
        modLoader,
      })

      setIsCreating(false)
      setIsSettingUp(true)
      setSetupStatus('Downloading Minecraft files...')

      try {
        await setupInstance(instance.id)
        setSetupStatus('Setup complete!')
        setTimeout(() => onClose(), 500)
      } catch (err: any) {
        setSetupStatus(`Setup failed: ${err.message}`)
        setTimeout(() => onClose(), 2000)
      }
    } catch (e: any) {
      setSetupStatus(`Failed: ${e.message}`)
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface-900 border border-surface-700/50 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">New Instance</h2>
            {!isSettingUp && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-surface-800 flex items-center justify-center text-surface-400 hover:text-white transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          {isSettingUp ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-8">
                <div className="w-12 h-12 rounded-xl bg-flexo-500/10 flex items-center justify-center mb-4">
                  <div className="w-8 h-8 border-2 border-flexo-400/30 border-t-flexo-400 rounded-full animate-spin" />
                </div>
                <h3 className="text-sm font-medium text-white mb-1">Setting up {name}</h3>
                <p className="text-xs text-surface-400">{setupStatus}</p>
              </div>
            </div>
          ) : step === 'name' ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-surface-400 mb-1.5 block">Instance Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Minecraft Instance"
                  className="w-full h-10 px-3 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm focus:outline-none focus:border-flexo-500/50 focus:ring-1 focus:ring-flexo-500/20 transition-all"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep('version')}
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => name.trim() && setStep('version')}
                  disabled={!name.trim()}
                  className="px-4 py-2 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          ) : step === 'version' ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-surface-400 mb-1.5 block">Minecraft Version</label>
                <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto">
                  {MINECRAFT_VERSIONS.map((v) => (
                    <button
                      key={v}
                      onClick={() => setVersion(v)}
                      className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        version === v
                          ? 'bg-flexo-500/20 text-flexo-400 border border-flexo-500/30'
                          : 'bg-surface-800 text-surface-300 border border-surface-700 hover:border-surface-600'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => setStep('name')}
                  className="px-4 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('loader')}
                  className="px-4 py-2 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-surface-400 mb-1.5 block">Mod Loader</label>
                <div className="space-y-2">
                  {MOD_LOADERS.map((loader) => (
                    <button
                      key={loader.id}
                      onClick={() => setModLoader(loader.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                        modLoader === loader.id
                          ? 'bg-flexo-500/5 border-flexo-500/20'
                          : 'bg-surface-800/30 border-surface-700/30 hover:border-surface-600/50'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        modLoader === loader.id ? 'border-flexo-500' : 'border-surface-600'
                      }`}>
                        {modLoader === loader.id && <div className="w-1.5 h-1.5 rounded-full bg-flexo-500" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-white">{loader.label}</h4>
                        <p className="text-xs text-surface-500">{loader.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => setStep('version')}
                  className="px-4 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isCreating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {isCreating ? 'Creating...' : 'Create & Download'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
