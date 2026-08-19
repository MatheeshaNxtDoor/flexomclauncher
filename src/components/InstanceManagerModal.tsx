import { useState, useEffect, useCallback } from 'react'
import { GameInstance, useInstanceStore } from '../stores/instanceStore'

const CONTENT_TYPES = [
  { key: 'mod', label: 'Mods', dir: 'mods', ext: '.jar' },
  { key: 'shader', label: 'Shader Packs', dir: 'shaderpacks', ext: '.zip' },
  { key: 'resourcepack', label: 'Resource Packs', dir: 'resourcepacks', ext: '.zip' },
  { key: 'datapack', label: 'Datapacks', dir: 'datapacks', ext: '' },
] as const

type ContentFile = { filename: string; disabled: boolean }

interface Props {
  instance: GameInstance
  onClose: () => void
}

export default function InstanceManagerModal({ instance, onClose }: Props) {
  const { loadInstances } = useInstanceStore()
  const [activeTab, setActiveTab] = useState<string>('mod')
  const [files, setFiles] = useState<Record<string, ContentFile[]>>({
    mod: [], shader: [], resourcepack: [], datapack: [],
  })
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    const results: Record<string, ContentFile[]> = {}
    for (const ct of CONTENT_TYPES) {
      try {
        results[ct.key] = await window.electronAPI.instances.listContentFiles(instance.id, ct.key)
      } catch {
        results[ct.key] = []
      }
    }
    setFiles(results)
    setLoading(false)
  }, [instance.id])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleToggle = async (contentType: string, filename: string) => {
    setToggling(filename)
    try {
      await window.electronAPI.instances.toggleModFile(instance.id, contentType, filename)
      await loadFiles()
    } catch (err) {
      console.error('Toggle failed:', err)
    } finally {
      setToggling(null)
    }
  }

  const handleRemove = async (contentType: string, filename: string) => {
    setRemoving(filename)
    try {
      await window.electronAPI.instances.deleteModFile(instance.id, contentType, filename)
      await window.electronAPI.instances.removeMod(instance.id, filename.replace(/\.(jar|zip|disabled)$/, ''))
      await loadFiles()
      await loadInstances()
    } catch (err) {
      console.error('Remove failed:', err)
    } finally {
      setRemoving(null)
      setConfirmDelete(null)
    }
  }

  const activeContent = CONTENT_TYPES.find(ct => ct.key === activeTab)!
  const currentFiles = files[activeTab] || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-surface-900 border border-surface-700/50 rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-700/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: `${instance.iconColor}20`, color: instance.iconColor }}
            >
              {instance.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{instance.name}</h2>
              <p className="text-xs text-surface-400">
                {instance.version} &middot; {instance.modLoader === 'vanilla' ? 'Vanilla' : instance.modLoader.charAt(0).toUpperCase() + instance.modLoader.slice(1)}
              </p>
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

        {/* Tabs */}
        <div className="flex border-b border-surface-700/50 shrink-0">
          {CONTENT_TYPES.map(ct => {
            const count = (files[ct.key] || []).length
            return (
              <button
                key={ct.key}
                onClick={() => setActiveTab(ct.key)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === ct.key
                    ? 'text-flexo-400 border-b-2 border-flexo-500 bg-flexo-500/5'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
                }`}
              >
                {ct.label}
                {count > 0 && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-surface-700 text-surface-300">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-surface-600 border-t-flexo-400 rounded-full animate-spin" />
            </div>
          ) : currentFiles.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-surface-800/50 border border-surface-700/50 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-surface-500">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
              </div>
              <p className="text-sm text-surface-400 mb-1">No {activeContent.label.toLowerCase()} installed</p>
              <p className="text-xs text-surface-500">Install {activeContent.label.toLowerCase()} from the marketplace to see them here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {currentFiles.map(file => {
                const isDisabled = file.disabled || file.filename.endsWith('.disabled')
                const displayName = isDisabled
                  ? file.filename.replace(/\.disabled$/, '')
                  : file.filename
                const isToggling = toggling === file.filename
                const isRemoving = removing === file.filename
                const isConfirming = confirmDelete === file.filename

                return (
                  <div
                    key={file.filename}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isDisabled
                        ? 'bg-surface-800/30 border-surface-700/30 opacity-60'
                        : 'bg-surface-800/50 border-surface-700/50 hover:border-surface-600/50'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isDisabled ? 'bg-surface-700/50' : 'bg-flexo-500/10'
                    }`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isDisabled ? 'text-surface-500' : 'text-flexo-400'}>
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                      </svg>
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isDisabled ? 'text-surface-400 line-through' : 'text-white'}`}>
                        {displayName}
                      </p>
                      {isDisabled && (
                        <p className="text-[10px] text-surface-500 mt-0.5">Disabled</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(activeTab, file.filename)}
                        disabled={isToggling || isRemoving}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
                          isDisabled
                            ? 'bg-surface-700/50 hover:bg-surface-600/50 text-surface-400'
                            : 'bg-flexo-500/10 hover:bg-flexo-500/20 text-flexo-400'
                        }`}
                        title={isDisabled ? 'Enable' : 'Disable'}
                      >
                        {isToggling ? (
                          <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        ) : isDisabled ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>

                      {/* Remove */}
                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRemove(activeTab, file.filename)}
                            disabled={isRemoving}
                            className="px-2 py-1 rounded text-[10px] font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                          >
                            {isRemoving ? '...' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-2 py-1 rounded text-[10px] font-medium bg-surface-700 hover:bg-surface-600 text-surface-300 transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(file.filename)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-700/50 hover:bg-red-500/10 text-surface-400 hover:text-red-400 transition-colors"
                          title="Remove"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-700/50 flex items-center justify-between shrink-0">
          <p className="text-xs text-surface-500">
            {currentFiles.length} {activeContent.label.toLowerCase()} &middot; {instance.gameDirectory}/{activeContent.dir}/
          </p>
        </div>
      </div>
    </div>
  )
}
