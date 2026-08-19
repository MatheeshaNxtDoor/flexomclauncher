import { useState, useEffect } from 'react'
import { useInstanceStore, GameInstance } from '../stores/instanceStore'

interface DetectedInstall {
  versionId: string
  gameVersion: string
  modLoader: string
  modLoaderVersion: string
  gameDirectory: string
  jarExists: boolean
  modsCount: number
  name: string
}

interface Props {
  onClose: () => void
}

export default function ImportExistingModal({ onClose }: Props) {
  const { loadInstances } = useInstanceStore()
  const [installDir, setInstallDir] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [detected, setDetected] = useState<DetectedInstall[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [isScanning, setIsScanning] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)
  const [error, setError] = useState('')
  const [customName, setCustomName] = useState<Record<number, string>>({})
  const [alreadyImported, setAlreadyImported] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadSuggestions()
  }, [])

  const loadSuggestions = async () => {
    try {
      const s = await window.electronAPI.import.getSuggestions()
      setSuggestions(s)
      if (s.length > 0 && !installDir) {
        setInstallDir(s[0])
      }
    } catch {}
  }

  const handleScan = async () => {
    if (!installDir.trim()) return
    setIsScanning(true)
    setError('')
    setDetected([])
    setSelected(new Set())
    setScanComplete(false)
    try {
      const results = await window.electronAPI.import.scan(installDir.trim())
      setDetected(results)
      setScanComplete(true)
      if (results.length === 0) {
        setError('No Minecraft installations found in this directory')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scan directory')
    } finally {
      setIsScanning(false)
    }
  }

  const handleToggle = (index: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleImport = async () => {
    if (selected.size === 0) return
    setIsImporting(true)
    try {
      let imported = 0
      for (const index of selected) {
        const install = detected[index]
        const name = customName[index] || install.name
        await window.electronAPI.import.addInstance({
          name,
          gameDirectory: install.gameDirectory,
          version: install.gameVersion,
          versionId: install.versionId,
          modLoader: install.modLoader,
          modLoaderVersion: install.modLoaderVersion,
        })
        imported++
      }
      await loadInstances()
      onClose()
    } catch (err: any) {
      setError(`Failed to import: ${err.message}`)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-surface-900 border border-surface-700/50 rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-700/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-flexo-500/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-flexo-400">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Import Existing Installations</h2>
              <p className="text-xs text-surface-400">Detect Minecraft versions from your .minecraft directory</p>
            </div>
          </div>
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

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Directory Input */}
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Minecraft Directory</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={installDir}
                onChange={(e) => setInstallDir(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                placeholder={suggestions[0] || 'e.g. ~/.minecraft'}
                className="flex-1 h-10 px-3 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm font-mono focus:outline-none focus:border-flexo-500/50 placeholder:text-surface-500"
              />
              <button
                onClick={handleScan}
                disabled={isScanning || !installDir.trim()}
                className="px-4 h-10 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isScanning ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                )}
                Scan
              </button>
            </div>
            {suggestions.length > 1 && (
              <div className="flex gap-1.5 mt-2">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => setInstallDir(s)}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                      installDir === s
                        ? 'bg-flexo-500/20 text-flexo-400'
                        : 'bg-surface-800 text-surface-500 hover:text-surface-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Detected List */}
          {scanComplete && detected.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-surface-400">
                  Found {detected.length} installation{detected.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => {
                    if (selected.size === detected.length) {
                      setSelected(new Set())
                    } else {
                      setSelected(new Set(detected.map((_, i) => i)))
                    }
                  }}
                  className="text-[10px] text-flexo-400 hover:text-flexo-300 transition-colors"
                >
                  {selected.size === detected.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="space-y-2">
                {detected.map((install, index) => {
                  const isSelected = selected.has(index)
                  return (
                    <div
                      key={index}
                      onClick={() => handleToggle(index)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-flexo-500/5 border-flexo-500/30'
                          : 'bg-surface-800/30 border-surface-700/50 hover:border-surface-600/50'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                        isSelected ? 'bg-flexo-500 border-flexo-500' : 'border-surface-600'
                      }`}>
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </div>

                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        install.modLoader === 'vanilla' ? 'bg-surface-700/50' : 'bg-flexo-500/10'
                      }`}>
                        {install.modLoader === 'vanilla' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-400">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <rect x="7" y="7" width="3" height="3"/>
                            <rect x="14" y="7" width="3" height="3"/>
                            <rect x="7" y="14" width="3" height="3"/>
                            <rect x="14" y="14" width="3" height="3"/>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-flexo-400">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                          </svg>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">{install.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            install.modLoader === 'vanilla'
                              ? 'bg-surface-700/50 text-surface-400'
                              : 'bg-flexo-500/20 text-flexo-400'
                          }`}>
                            {install.modLoader === 'vanilla' ? 'Vanilla' : install.modLoader.charAt(0).toUpperCase() + install.modLoader.slice(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-surface-500">{install.versionId}</span>
                          {install.modsCount > 0 && (
                            <span className="text-[10px] text-surface-500">{install.modsCount} mods</span>
                          )}
                          {install.jarExists ? (
                            <span className="text-[10px] text-green-400">Client JAR found</span>
                          ) : (
                            <span className="text-[10px] text-yellow-400">No client JAR</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-700/50 flex items-center justify-between shrink-0">
          <p className="text-xs text-surface-500">
            {selected.size > 0 ? `${selected.size} selected` : 'Select installations to import'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-300 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || isImporting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isImporting && (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {isImporting ? 'Importing...' : `Import ${selected.size > 0 ? `(${selected.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
