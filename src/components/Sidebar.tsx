import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore, Account } from '../stores/authStore'
import { useInstanceStore } from '../stores/instanceStore'
import { useState, useEffect } from 'react'

const navItems = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/marketplace', label: 'Marketplace', icon: StoreIcon },
  { path: '/downloads', label: 'Downloads', icon: DownloadIcon },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
]

export default function Sidebar() {
  const { currentAccount, accounts, switchAccount, logout } = useAuthStore()
  const navigate = useNavigate()
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [showStorage, setShowStorage] = useState(true)

  const handleSwitchAccount = async (id: string) => {
    await switchAccount(id)
    setShowAccountMenu(false)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="w-56 bg-surface-900/50 border-r border-surface-800/50 flex flex-col shrink-0">
      <div className="px-4 py-4 border-b border-surface-800/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-flexo-500 flex items-center justify-center shadow-lg shadow-flexo-500/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">Flexo</span>
        </div>
      </div>

      <div className="px-3 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-surface-500 px-2 mb-1">Menu</p>
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-flexo-500/10 text-flexo-400 font-medium'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex-1" />

      {showStorage && (
        <div className="mx-3 mb-3">
          <div className="bg-surface-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-surface-300">Storage</span>
              <span className="text-xs text-surface-500">12.4 GB / 50 GB</span>
            </div>
            <div className="w-full h-1.5 bg-surface-700 rounded-full overflow-hidden">
              <div className="h-full bg-flexo-500 rounded-full" style={{ width: '25%' }} />
            </div>
          </div>
        </div>
      )}

      <div className="mx-3 mb-3 relative">
        <button
          onClick={() => setShowAccountMenu(!showAccountMenu)}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-surface-800/50 hover:bg-surface-800 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-flexo-600 flex items-center justify-center text-white text-sm font-semibold">
            {currentAccount?.playerName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {currentAccount?.playerName || 'Not logged in'}
            </p>
            <p className="text-[10px] text-surface-500">
              {currentAccount?.type === 'discord' ? 'Discord' : currentAccount?.type === 'microsoft' ? 'Microsoft' : 'Guest'}
            </p>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgb(90, 90, 100)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6l6-6"/>
          </svg>
        </button>

        {showAccountMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="p-2 border-b border-surface-700">
                <p className="text-[10px] font-medium uppercase tracking-wider text-surface-500 px-2">Accounts</p>
              </div>
              <div className="p-1 max-h-48 overflow-y-auto">
                {accounts.map((account: Account) => (
                  <button
                    key={account.id}
                    onClick={() => handleSwitchAccount(account.id)}
                    className={`w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors ${
                      account.id === currentAccount?.id
                        ? 'bg-flexo-500/10 text-flexo-400'
                        : 'text-surface-300 hover:bg-surface-700/50'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-surface-600 flex items-center justify-center text-xs font-medium">
                      {account.playerName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm truncate">{account.playerName}</span>
                    <span className="text-[10px] text-surface-500 ml-auto">
                      {account.type === 'discord' ? 'Discord' : 'Microsoft'}
                    </span>
                  </button>
                ))}
              </div>
              <div className="p-1 border-t border-surface-700">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 p-2 rounded-md text-red-400 hover:bg-red-500/10 text-sm transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  )
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
