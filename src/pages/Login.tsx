import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useEffect, useState } from 'react'

export default function Login() {
  const { login, isLoading, error, isAuthenticated, loadAccounts } = useAuthStore()
  const navigate = useNavigate()
  const [version, setVersion] = useState('1.0.0')

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    window.electronAPI.app.getInfo().then((info) => setVersion(info.version))
  }, [])

  const handleDiscordLogin = async () => {
    try {
      await login()
      navigate('/', { replace: true })
    } catch (e) {
      console.error('Login failed:', e)
    }
  }

  return (
    <div className="flex h-screen bg-surface-950">
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-gradient-to-br from-surface-900 via-surface-950 to-flexo-950/30">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(34, 197, 94, 0.3) 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-flexo-500/10 rounded-full blur-[100px]" />

        <div className="relative z-10 text-center px-12 max-w-lg">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-flexo-500 flex items-center justify-center shadow-lg shadow-flexo-500/25 animate-pulse-glow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">Flexo Launcher</span>
          </div>

          <p className="text-flexo-400/80 text-sm font-medium tracking-wide mb-4">Play &#8226; Mod &#8226; Manage</p>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Every mod. Every world. One launcher.
          </h1>
          <p className="text-surface-400 text-base leading-relaxed mb-8">
            Browse Modrinth and CurseForge, manage every instance, and jump straight into the game — all from one quiet, fast desktop app.
          </p>

          <div className="flex items-center justify-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-800/80 border border-surface-700/50 text-xs text-surface-300">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>
              Modrinth
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-800/80 border border-surface-700/50 text-xs text-surface-300">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>
              CurseForge
            </span>
            <span className="text-xs text-surface-500">v{version}</span>
          </div>
        </div>
      </div>

      <div className="w-[420px] flex items-center justify-center p-12 bg-surface-900/30">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-surface-400 text-sm">Sign in to sync your instances and mods.</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleDiscordLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#5865F2]/20 hover:shadow-[#5865F2]/30"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              )}
              {isLoading ? 'Connecting...' : 'Login with Discord'}
            </button>

            <button
              disabled
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-surface-800 border border-surface-700 text-surface-500 font-medium text-sm cursor-not-allowed opacity-50"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.4 24H0V12.6L11.4 0H24v11.4L12.6 24h-1.2zM1.2 12.8V22.8H11.4V12.8H1.2zM12.6 12.8V22.8H22.8V12.8H12.6zM11.4 1.2V11.4H1.2L11.4 1.2z"/>
              </svg>
              Microsoft Login
              <span className="text-[10px] bg-surface-700 px-1.5 py-0.5 rounded ml-1">Soon</span>
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-surface-800/50">
            <p className="text-center text-xs text-surface-600">
              By signing in, you agree to our Terms of Service
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
