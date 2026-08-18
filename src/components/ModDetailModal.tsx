import { Mod } from '../stores/marketplaceStore'
import { useState, useEffect } from 'react'
import { useInstanceStore } from '../stores/instanceStore'
import { useDownloadStore } from '../stores/downloadStore'

export default function ModDetailModal({ mod, onClose }: { mod: Mod; onClose: () => void }) {
  const { instances, loadInstances } = useInstanceStore()
  const { addDownload, updateDownload, setupListeners } = useDownloadStore()
  const [selectedInstanceId, setSelectedInstanceId] = useState('')
  const [isInstalling, setIsInstalling] = useState(false)
  const [installStatus, setInstallStatus] = useState('')
  const [versions, setVersions] = useState<any[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [loadingVersions, setLoadingVersions] = useState(true)

  useEffect(() => {
    loadInstances()
    setupListeners()
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
    if (!selectedInstanceId || !selectedVersionId) return
    setIsInstalling(true)
    setInstallStatus('Starting download...')

    const instance = instances.find(i => i.id === selectedInstanceId)
    if (!instance) {
      setInstallStatus('Instance not found')
      setIsInstalling(false)
      return
    }

    const projectType = mod.projectType || 'mod'
    const subDir = projectType === 'shader' ? 'shaderpacks'
      : projectType === 'resourcepack' ? 'resourcepacks'
      : 'mods'
    const targetDir = `${instance.gameDirectory}/${subDir}`
    const version = versions.find(v => v.id === selectedVersionId)
    const downloadId = `mod-${mod.id}-${Date.now()}`

    addDownload({
      id: downloadId,
      name: mod.title,
      version: version?.version_number || selectedVersionId,
      source: 'modrinth',
      status: 'downloading',
      progress: 0,
      speed: 0,
      eta: 0,
      instanceId: selectedInstanceId,
      startedAt: Date.now(),
      type: projectType as any,
    })

    let progress = 0
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        progress += Math.random() * 15 + 5
        if (progress > 90) progress = 90
        updateDownload(downloadId, { progress, speed: (Math.random() * 5 + 2) * 1024 * 1024 })
      }
    }, 300)

    try {
      setInstallStatus('Downloading...')
      await window.electronAPI.marketplace.installMod(mod.id, selectedVersionId, targetDir)

      clearInterval(progressInterval)
      updateDownload(downloadId, { progress: 100, speed: 0 })

      await window.electronAPI.instances.addMod(selectedInstanceId, {
        id: mod.id,
        name: mod.title,
        version: version?.version_number || '',
        source: 'modrinth',
        filename: '',
      })

      updateDownload(downloadId, {
        status: 'completed',
        progress: 100,
        completedAt: Date.now(),
      })

      setInstallStatus('Installed successfully!')
      setTimeout(() => onClose(), 1000)
    } catch (err: any) {
      clearInterval(progressInterval)
      updateDownload(downloadId, {
        status: 'failed',
        error: err.message,
        completedAt: Date.now(),
      })
      setInstallStatus(`Failed: ${err.message}`)
    } finally {
      setIsInstalling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[80vh] bg-surface-900 border border-surface-700/50 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="relative h-40">
          <div className="absolute inset-0 bg-gradient-to-br from-flexo-500/10 to-surface-900" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-surface-900/60 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-surface-800/80 hover:bg-surface-700 flex items-center justify-center text-surface-400 hover:text-white transition-colors z-10"
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
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  </svg>
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{mod.title}</h2>
              <p className="text-sm text-surface-400">by {mod.author}</p>
            </div>
          </div>
        </div>

        <div className="flex">
          <div className="flex-1 p-6 overflow-y-auto max-h-[50vh]">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-500">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span className="text-xs text-surface-400">{formatDownloads(mod.downloads)} downloads</span>
              </div>
              {mod.clientSide && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                  Client: {mod.clientSide}
                </span>
              )}
              {mod.serverSide && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                  Server: {mod.serverSide}
                </span>
              )}
            </div>

            <p className="text-sm text-surface-300 leading-relaxed mb-4">
              {mod.description}
            </p>

            {mod.body && (
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="text-sm text-surface-400 whitespace-pre-wrap">{mod.body}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 mt-4">
              {mod.categories.map((cat) => (
                <span key={cat} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-700/50 text-surface-400">
                  {cat}
                </span>
              ))}
            </div>
          </div>

          <div className="w-64 p-6 border-l border-surface-700/50">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-3">Install</h3>

            <div className="mb-4">
              <label className="text-xs text-surface-400 mb-1.5 block">Version</label>
              {loadingVersions ? (
                <div className="w-full h-9 rounded-lg bg-surface-800 border border-surface-700 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-surface-600 border-t-surface-400 rounded-full animate-spin" />
                </div>
              ) : (
                <select
                  value={selectedVersionId}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm focus:outline-none focus:border-flexo-500/50"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version_number} ({v.version_type})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="mb-4">
              <label className="text-xs text-surface-400 mb-1.5 block">Target Instance</label>
              <select
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm focus:outline-none focus:border-flexo-500/50"
              >
                <option value="">Select instance...</option>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} ({inst.version})
                  </option>
                ))}
              </select>
            </div>

            {installStatus && (
              <div className={`mb-3 p-2 rounded-lg text-xs ${
                installStatus.includes('Failed')
                  ? 'bg-red-500/10 text-red-400'
                  : installStatus.includes('success') || installStatus.includes('Installed')
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-surface-800 text-surface-300'
              }`}>
                {installStatus}
              </div>
            )}

            <button
              onClick={handleInstall}
              disabled={isInstalling || !selectedInstanceId || !selectedVersionId}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              {isInstalling ? 'Installing...' : 'Install'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDownloads(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}
