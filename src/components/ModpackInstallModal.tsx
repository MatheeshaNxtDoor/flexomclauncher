import { Mod } from '../stores/marketplaceStore'
import { useState, useEffect } from 'react'
import { useDownloadStore } from '../stores/downloadStore'

export default function ModpackInstallModal({ mod, onClose }: { mod: Mod; onClose: () => void }) {
  const { addDownload, updateDownload } = useDownloadStore()
  const [versions, setVersions] = useState<any[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [loadingVersions, setLoadingVersions] = useState(true)
  const [isInstalling, setIsInstalling] = useState(false)
  const [installStatus, setInstallStatus] = useState('')
  const [installStep, setInstallStep] = useState('')
  const [instanceName, setInstanceName] = useState(mod.title)

  useEffect(() => {
    loadVersions()
  }, [])

  const loadVersions = async () => {
    try {
      const result = await window.electronAPI.marketplace.getVersions(mod.id)
      setVersions(result)
      if (result.length > 0) {
        setSelectedVersionId(result[0].id)
      }
    } catch (err) {
      console.error('Failed to load versions:', err)
    } finally {
      setLoadingVersions(false)
    }
  }

  const handleInstall = async () => {
    if (!selectedVersionId || !instanceName.trim()) return
    setIsInstalling(true)
    setInstallStatus('Creating instance...')

    const version = versions.find(v => v.id === selectedVersionId)
    if (!version) {
      setInstallStatus('Version not found')
      setIsInstalling(false)
      return
    }

    const downloadId = `modpack-${mod.id}-${Date.now()}`

    addDownload({
      id: downloadId,
      name: mod.title,
      version: version.version_number || selectedVersionId,
      source: 'modrinth',
      status: 'downloading',
      progress: 5,
      speed: 0,
      eta: 0,
      instanceId: '',
      startedAt: Date.now(),
      type: 'modpack',
    })

    let progress = 5
    const progressInterval = setInterval(() => {
      if (progress < 85) {
        progress += Math.random() * 4 + 1
        if (progress > 85) progress = 85
        updateDownload(downloadId, { progress, speed: (Math.random() * 3 + 1) * 1024 * 1024 })
      }
    }, 500)

    try {
      const mcVersion = version.game_versions?.[0] || '1.21.4'
      const loader = version.loaders?.[0] || 'fabric'

      updateDownload(downloadId, { progress: 10 })
      setInstallStep('Creating instance...')
      setInstallStatus(`Creating ${loader} instance for ${mcVersion}...`)
      const instance = await window.electronAPI.instances.create({
        name: instanceName,
        version: mcVersion,
        modLoader: loader,
        modLoaderVersion: '',
      })

      updateDownload(downloadId, { instanceId: instance.id, progress: 15 })
      setInstallStep('Setting up Minecraft files...')
      setInstallStatus('Downloading Minecraft, libraries, and assets...')
      await window.electronAPI.instance.setup(instance.id)

      const primaryFile = version.files?.find((f: any) => f.primary) || version.files?.[0]
      if (primaryFile) {
        updateDownload(downloadId, { progress: 75 })
        setInstallStep('Installing modpack...')
        setInstallStatus('Extracting and installing modpack files...')
        const instanceData = await window.electronAPI.instances.get(instance.id)
        await window.electronAPI.modpack.install(
          primaryFile.url,
          instanceData.gameDirectory
        )
      }

      clearInterval(progressInterval)
      updateDownload(downloadId, { progress: 100, speed: 0, status: 'completed', completedAt: Date.now() })
      setInstallStatus('Modpack installed successfully!')
      setTimeout(() => onClose(), 1500)
    } catch (err: any) {
      clearInterval(progressInterval)
      updateDownload(downloadId, { status: 'failed', error: err.message, progress: 0, completedAt: Date.now() })
      setInstallStatus(`Failed: ${err.message}`)
    } finally {
      setIsInstalling(false)
    }
  }

  const selectedVersion = versions.find(v => v.id === selectedVersionId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-surface-900 border border-surface-700/50 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="relative h-40">
          <div className="absolute inset-0 bg-gradient-to-br from-flexo-500/10 to-surface-900" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-surface-900/60 to-transparent" />
          <button
            onClick={onClose}
            disabled={isInstalling}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-surface-800/80 hover:bg-surface-700 flex items-center justify-center text-surface-400 hover:text-white transition-colors z-10 disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div className="absolute bottom-4 left-6 flex items-end gap-4">
            <div className="w-16 h-16 rounded-xl bg-surface-800 border border-surface-700/50 overflow-hidden shadow-lg">
              {mod.iconUrl ? (
                <img src={mod.iconUrl} alt={mod.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-surface-500">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                  </svg>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{mod.title}</h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-flexo-500/20 text-flexo-400 font-medium">MODPACK</span>
              </div>
              <p className="text-sm text-surface-400">by {mod.author}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm text-surface-300 leading-relaxed mb-4">
            {mod.description}
          </p>

          <p className="text-xs text-surface-400 mb-6">
            This will create a new instance with the modpack's Minecraft version and mod loader configured automatically.
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-surface-400 mb-1.5 block">Instance Name</label>
              <input
                type="text"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                disabled={isInstalling}
                className="w-full h-9 px-3 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm focus:outline-none focus:border-flexo-500/50 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-xs text-surface-400 mb-1.5 block">Version</label>
              {loadingVersions ? (
                <div className="w-full h-9 rounded-lg bg-surface-800 border border-surface-700 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-surface-600 border-t-surface-400 rounded-full animate-spin" />
                </div>
              ) : (
                <select
                  value={selectedVersionId}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  disabled={isInstalling}
                  className="w-full h-9 px-3 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm focus:outline-none focus:border-flexo-500/50 disabled:opacity-50"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version_number} ({v.game_versions?.[0] || '?'} / {v.loaders?.[0] || '?'})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedVersion && (
              <div className="flex flex-wrap gap-2">
                {selectedVersion.game_versions?.map((gv: string) => (
                  <span key={gv} className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                    MC {gv}
                  </span>
                ))}
                {selectedVersion.loaders?.map((l: string) => (
                  <span key={l} className="text-[10px] px-2 py-0.5 rounded bg-flexo-500/10 text-flexo-400 capitalize">
                    {l}
                  </span>
                ))}
              </div>
            )}
          </div>

          {installStatus && (
            <div className={`mt-4 p-3 rounded-lg text-xs ${
              installStatus.includes('Failed')
                ? 'bg-red-500/10 text-red-400'
                : installStatus.includes('success')
                ? 'bg-green-500/10 text-green-400'
                : 'bg-surface-800 text-surface-300'
            }`}>
              <div className="flex items-center gap-2">
                {isInstalling && !installStatus.includes('Failed') && !installStatus.includes('success') && (
                  <div className="w-3 h-3 border-2 border-flexo-400/30 border-t-flexo-400 rounded-full animate-spin shrink-0" />
                )}
                <span>{installStatus}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={isInstalling}
              className="flex-1 px-4 py-2.5 rounded-lg bg-surface-800 text-surface-400 text-sm font-medium hover:bg-surface-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleInstall}
              disabled={isInstalling || !selectedVersionId || !instanceName.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isInstalling ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              )}
              {isInstalling ? 'Installing...' : 'Install Modpack'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
