import { useDownloadStore, DownloadItem } from '../stores/downloadStore'
import { useEffect, useState } from 'react'

export default function Downloads() {
  const { downloads, clearCompleted } = useDownloadStore()
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  const filtered = downloads.filter((d) => {
    if (filter === 'active') return d.status === 'downloading' || d.status === 'queued' || d.status === 'installing'
    if (filter === 'completed') return d.status === 'completed' || d.status === 'failed'
    return true
  })

  const activeDownload = downloads.find((d) => d.status === 'downloading')

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Downloads</h1>
          <p className="text-sm text-surface-400 mt-1">
            {downloads.length} download{downloads.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearCompleted}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-800/50 text-surface-400 border border-surface-700/50 hover:text-surface-200 transition-colors"
          >
            Clear completed
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {[
          { id: 'all', label: 'All' },
          { id: 'active', label: 'Active' },
          { id: 'completed', label: 'Completed' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-flexo-500/10 text-flexo-400 border border-flexo-500/20'
                : 'bg-surface-800/50 text-surface-400 border border-surface-700/50 hover:text-surface-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {activeDownload && (
        <div className="mb-6 p-4 rounded-xl bg-surface-800/50 border border-flexo-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-flexo-500/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(34, 197, 94)" strokeWidth="2" className="animate-bounce">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-white truncate">{activeDownload.name}</h3>
                <span className="text-xs text-flexo-400 ml-2">{Math.round(activeDownload.progress)}%</span>
              </div>
              <div className="w-full h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-flexo-500 rounded-full transition-all duration-300"
                  style={{ width: `${activeDownload.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-surface-500">
                  {activeDownload.speed > 0 ? `${(activeDownload.speed / 1024 / 1024).toFixed(1)} MB/s` : 'Starting...'}
                </span>
                <span className="text-[10px] text-surface-500">
                  {activeDownload.eta > 0 ? `${Math.ceil(activeDownload.eta / 1000)}s remaining` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-surface-800/50 border border-surface-700/50 flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgb(113, 113, 122)" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <h3 className="text-sm font-medium text-surface-300 mb-1">No downloads</h3>
          <p className="text-xs text-surface-500">Mods you download will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <DownloadRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function DownloadRow({ item }: { item: DownloadItem }) {
  const statusColors: Record<string, string> = {
    queued: 'text-surface-500',
    downloading: 'text-flexo-400',
    installing: 'text-blue-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
    cancelled: 'text-surface-500',
  }

  const statusLabels: Record<string, string> = {
    queued: 'Queued',
    downloading: 'Downloading',
    installing: 'Installing',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }

  const statusIcons: Record<string, React.ReactNode> = {
    queued: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    downloading: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-bounce">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
    installing: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
    ),
    completed: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    failed: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    ),
    cancelled: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    ),
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-800/30 border border-surface-700/30">
      <div className={`w-8 h-8 rounded-md bg-surface-700/50 flex items-center justify-center ${statusColors[item.status]}`}>
        {statusIcons[item.status]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-white truncate">{item.name}</h4>
          <span className={`text-xs ${statusColors[item.status]} ml-2`}>
            {statusLabels[item.status]}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-surface-500">{item.source}</span>
          <span className="text-[10px] text-surface-600">&middot;</span>
          <span className="text-[10px] text-surface-500">{item.version}</span>
          {item.status === 'downloading' && (
            <>
              <span className="text-[10px] text-surface-600">&middot;</span>
              <span className="text-[10px] text-flexo-400">{Math.round(item.progress)}%</span>
            </>
          )}
        </div>
        {item.status === 'downloading' && (
          <div className="w-full h-1 bg-surface-700 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-flexo-500 rounded-full transition-all duration-300"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
