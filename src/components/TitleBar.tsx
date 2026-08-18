import { useAuthStore } from '../stores/authStore'

export default function TitleBar() {
  const currentAccount = useAuthStore((s) => s.currentAccount)

  return (
    <div className="h-10 bg-surface-950 border-b border-surface-800/50 flex items-center justify-between px-4 drag-region shrink-0">
      <div className="flex items-center gap-2 no-drag">
        <div className="w-5 h-5 rounded bg-flexo-500 flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span className="text-xs font-medium text-surface-400">Flexo Launcher</span>
      </div>
      <div className="flex items-center gap-1 no-drag">
        <button
          onClick={() => window.electronAPI.window.minimize()}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="6" x2="10" y2="6"/>
          </svg>
        </button>
        <button
          onClick={() => window.electronAPI.window.maximize()}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="8" height="8" rx="1"/>
          </svg>
        </button>
        <button
          onClick={() => window.electronAPI.window.close()}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-500/20 text-surface-400 hover:text-red-400 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="2" x2="10" y2="10"/>
            <line x1="10" y1="2" x2="2" y2="10"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
