import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'

const SETTINGS_SECTIONS = [
  { id: 'general', label: 'General', icon: GearIcon },
  { id: 'accounts', label: 'Accounts', icon: UserIcon },
  { id: 'java', label: 'Java', icon: CoffeeIcon },
  { id: 'minecraft', label: 'Minecraft', icon: CubeIcon },
  { id: 'about', label: 'About', icon: InfoIcon },
]

interface Settings {
  javaPath: string
  maxMemory: number
  minMemory: number
  gameDirectory: string
  jvmArgs: string
}

export default function Settings() {
  const [activeSection, setActiveSection] = useState('general')
  const { accounts, currentAccount, removeAccount, switchAccount } = useAuthStore()
  const [appInfo, setAppInfo] = useState({ version: '1.0.0', name: 'Flexo Launcher', isDev: false })
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'>('idle')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [updateProgress, setUpdateProgress] = useState<any>(null)
  const [updateError, setUpdateError] = useState('')
  const [settings, setSettings] = useState<Settings>({
    javaPath: '',
    maxMemory: 4096,
    minMemory: 1024,
    gameDirectory: '',
    jvmArgs: '',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.electronAPI.app.getInfo().then(setAppInfo)
    window.electronAPI.settings.get().then((s) => {
      setSettings({
        javaPath: s.javaPath || '',
        maxMemory: s.maxMemory || 4096,
        minMemory: s.minMemory || 1024,
        gameDirectory: s.gameDirectory || '',
        jvmArgs: (s.jvmArgs || []).join(' '),
      })
    })

    const unsubs = [
      window.electronAPI.updater.onUpdateAvailable((info: any) => {
        setUpdateStatus('available')
        setUpdateInfo(info)
      }),
      window.electronAPI.updater.onUpdateNotAvailable(() => {
        setUpdateStatus('not-available')
      }),
      window.electronAPI.updater.onDownloadProgress((progress: any) => {
        setUpdateStatus('downloading')
        setUpdateProgress(progress)
      }),
      window.electronAPI.updater.onUpdateDownloaded(() => {
        setUpdateStatus('downloaded')
      }),
      window.electronAPI.updater.onError((msg: string) => {
        setUpdateStatus('error')
        setUpdateError(msg)
      }),
    ]

    return () => unsubs.forEach(unsub => unsub())
  }, [])

  const handleSave = async () => {
    await window.electronAPI.settings.save({
      javaPath: settings.javaPath,
      maxMemory: settings.maxMemory,
      minMemory: settings.minMemory,
      gameDirectory: settings.gameDirectory,
      jvmArgs: settings.jvmArgs.split(/\s+/).filter(Boolean),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleCheckForUpdates = async () => {
    setUpdateStatus('checking')
    setUpdateError('')
    setUpdateProgress(null)
    setUpdateInfo(null)
    await window.electronAPI.updater.checkForUpdates()
  }

  const handleInstallUpdate = () => {
    window.electronAPI.updater.installUpdate()
  }

  return (
    <div className="flex h-full animate-fade-in">
      <div className="w-48 border-r border-surface-800/50 p-4">
        <h2 className="text-sm font-semibold text-white mb-4 px-2">Settings</h2>
        <nav className="flex flex-col gap-0.5">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSection === section.id
                  ? 'bg-flexo-500/10 text-flexo-400 font-medium'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
              }`}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {activeSection === 'general' && (
          <div className="max-w-2xl animate-slide-in">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-white">General</h2>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors"
              >
                {saved ? 'Saved!' : 'Save Settings'}
              </button>
            </div>
            <p className="text-sm text-surface-400 mb-6">Configure general launcher settings</p>

            <SettingsGroup title="Updates">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-medium text-white">Check for Updates</h4>
                    <p className="text-xs text-surface-500 mt-0.5">
                      Current version: {appInfo.version}
                    </p>
                  </div>
                  <button
                    onClick={handleCheckForUpdates}
                    disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                    className="px-4 py-2 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updateStatus === 'checking' ? 'Checking...' : 'Check for Updates'}
                  </button>
                </div>

                {updateStatus === 'not-available' && (
                  <div className="p-3 rounded-lg bg-green-500/10 text-green-400 text-xs">
                    You are running the latest version.
                  </div>
                )}

                {updateStatus === 'available' && updateInfo && (
                  <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 text-xs">
                    Update available: v{updateInfo.version}
                  </div>
                )}

                {updateStatus === 'downloading' && updateProgress && (
                  <div className="p-3 rounded-lg bg-surface-800 text-surface-300 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span>Downloading update...</span>
                      <span>{Math.round(updateProgress.percent || 0)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-flexo-500 transition-all duration-300"
                        style={{ width: `${updateProgress.percent || 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {updateStatus === 'downloaded' && (
                  <div className="p-3 rounded-lg bg-green-500/10 text-green-400 text-xs flex items-center justify-between">
                    <span>Update downloaded! It will install when you restart the launcher.</span>
                    <button
                      onClick={handleInstallUpdate}
                      className="px-3 py-1.5 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-xs font-medium transition-colors ml-3 shrink-0"
                    >
                      Restart Now
                    </button>
                  </div>
                )}

                {updateStatus === 'error' && (
                  <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-xs">
                    Update check failed: {updateError || 'Unknown error'}
                  </div>
                )}
              </div>
            </SettingsGroup>
          </div>
        )}

        {activeSection === 'accounts' && (
          <div className="max-w-2xl animate-slide-in">
            <h2 className="text-lg font-bold text-white mb-1">Accounts</h2>
            <p className="text-sm text-surface-400 mb-6">Manage your Minecraft accounts</p>

            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                    account.id === currentAccount?.id
                      ? 'bg-flexo-500/5 border-flexo-500/20'
                      : 'bg-surface-800/30 border-surface-700/30'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-flexo-600 flex items-center justify-center text-white font-semibold">
                    {account.playerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white">{account.playerName}</h3>
                    <p className="text-xs text-surface-500">
                      {account.type === 'discord' ? 'Discord' : 'Microsoft'} &middot; {account.id.slice(0, 8)}
                    </p>
                  </div>
                  {account.id === currentAccount?.id && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-flexo-500/20 text-flexo-400 font-medium">Active</span>
                  )}
                  {account.id !== currentAccount?.id && (
                    <button
                      onClick={() => switchAccount(account.id)}
                      className="text-xs text-surface-400 hover:text-flexo-400 transition-colors"
                    >
                      Switch
                    </button>
                  )}
                  <button
                    onClick={() => removeAccount(account.id)}
                    className="text-xs text-surface-500 hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {accounts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-surface-500 text-sm">No accounts added yet</p>
              </div>
            )}
          </div>
        )}

        {activeSection === 'java' && (
          <div className="max-w-2xl animate-slide-in">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-white">Java</h2>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors"
              >
                {saved ? 'Saved!' : 'Save Settings'}
              </button>
            </div>
            <p className="text-sm text-surface-400 mb-6">Configure Java runtime settings</p>

            <SettingsGroup title="Java Path">
              <SettingsRow
                label="Java Executable"
                description="Path to Java executable (javaw.exe on Windows)"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={settings.javaPath}
                    onChange={(e) => updateSetting('javaPath', e.target.value)}
                    className="flex-1 h-9 px-3 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm font-mono focus:outline-none focus:border-flexo-500/50"
                    placeholder="Auto-detect"
                  />
                </div>
              </SettingsRow>
            </SettingsGroup>

            <SettingsGroup title="Memory">
              <SettingsRow
                label="Maximum Memory"
                description="Maximum heap size in MB"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1024"
                    max="16384"
                    step="256"
                    value={settings.maxMemory}
                    onChange={(e) => updateSetting('maxMemory', Number(e.target.value))}
                    className="flex-1 accent-flexo-500"
                  />
                  <span className="text-sm text-white w-16 text-right">{settings.maxMemory} MB</span>
                </div>
              </SettingsRow>
              <SettingsRow
                label="Minimum Memory"
                description="Initial heap size in MB"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="512"
                    max="8192"
                    step="256"
                    value={settings.minMemory}
                    onChange={(e) => updateSetting('minMemory', Number(e.target.value))}
                    className="flex-1 accent-flexo-500"
                  />
                  <span className="text-sm text-white w-16 text-right">{settings.minMemory} MB</span>
                </div>
              </SettingsRow>
            </SettingsGroup>

            <SettingsGroup title="JVM Arguments">
              <SettingsRow
                label="Additional JVM Arguments"
                description="Extra arguments passed to the Java runtime"
              >
                <input
                  type="text"
                  value={settings.jvmArgs}
                  onChange={(e) => updateSetting('jvmArgs', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm font-mono focus:outline-none focus:border-flexo-500/50"
                  placeholder="-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions"
                />
              </SettingsRow>
            </SettingsGroup>
          </div>
        )}

        {activeSection === 'minecraft' && (
          <div className="max-w-2xl animate-slide-in">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-white">Minecraft</h2>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-flexo-500 hover:bg-flexo-600 text-white text-sm font-medium transition-colors"
              >
                {saved ? 'Saved!' : 'Save Settings'}
              </button>
            </div>
            <p className="text-sm text-surface-400 mb-6">Minecraft-specific settings</p>

            <SettingsGroup title="Game Directory">
              <SettingsRow
                label="Default Game Directory"
                description="Where Minecraft instances are stored"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={settings.gameDirectory}
                    onChange={(e) => updateSetting('gameDirectory', e.target.value)}
                    className="flex-1 h-9 px-3 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm font-mono focus:outline-none focus:border-flexo-500/50"
                    placeholder="Auto (AppData/flexo-launcher/instances)"
                  />
                </div>
              </SettingsRow>
            </SettingsGroup>
          </div>
        )}

        {activeSection === 'about' && (
          <div className="max-w-2xl animate-slide-in">
            <h2 className="text-lg font-bold text-white mb-1">About</h2>
            <p className="text-sm text-surface-400 mb-6">Launcher information</p>

            <div className="bg-surface-800/30 border border-surface-700/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-flexo-500 flex items-center justify-center shadow-lg shadow-flexo-500/20">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{appInfo.name}</h3>
                  <p className="text-sm text-surface-400">Version {appInfo.version}</p>
                </div>
              </div>
              <p className="text-sm text-surface-400 mb-4">
                A modern Minecraft launcher built with Electron and React.
                Browse Modrinth, manage instances, install mods, and launch the game.
              </p>
              <div className="flex gap-2">
                <span className="text-xs px-2 py-1 rounded bg-surface-700/50 text-surface-400">Electron</span>
                <span className="text-xs px-2 py-1 rounded bg-surface-700/50 text-surface-400">React</span>
                <span className="text-xs px-2 py-1 rounded bg-surface-700/50 text-surface-400">Tailwind CSS</span>
                <span className="text-xs px-2 py-1 rounded bg-surface-700/50 text-surface-400">Modrinth API</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-3">{title}</h3>
      <div className="bg-surface-800/30 border border-surface-700/30 rounded-xl divide-y divide-surface-700/30">
        {children}
      </div>
    </div>
  )
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between p-4 gap-6">
      <div className="min-w-0">
        <h4 className="text-sm font-medium text-white">{label}</h4>
        <p className="text-xs text-surface-500 mt-0.5">{description}</p>
      </div>
      <div className="shrink-0 w-64">{children}</div>
    </div>
  )
}

function GearIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}
function UserIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function CoffeeIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
}
function CubeIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
}
function InfoIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
}
