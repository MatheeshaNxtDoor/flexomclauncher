import fs from 'fs'
import path from 'path'
import os from 'os'

export interface DetectedInstallation {
  versionId: string
  gameVersion: string
  modLoader: 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt'
  modLoaderVersion: string
  gameDirectory: string
  jarExists: boolean
  modsCount: number
  name: string
}

function getDefaultMinecraftDir(): string {
  switch (process.platform) {
    case 'win32':
      return path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft')
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'minecraft')
    case 'linux':
    default:
      return path.join(os.homedir(), '.minecraft')
  }
}

function getAlternativePaths(): string[] {
  const home = os.homedir()
  const paths: string[] = []
  if (process.platform === 'win32') {
    paths.push(path.join(home, 'AppData', 'Roaming', '.minecraft'))
    paths.push('C:\\Program Files\\Minecraft Launcher\\minecraft')
  } else if (process.platform === 'darwin') {
    paths.push(path.join(home, 'Library', 'Application Support', 'minecraft'))
  } else {
    paths.push(path.join(home, '.minecraft'))
    paths.push(path.join(home, 'minecraft'))
  }
  return [...new Set(paths)]
}

function detectModLoader(versionJson: any, libraries: any[]): {
  modLoader: 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt'
  modLoaderVersion: string
  gameVersion: string
} {
  const id: string = versionJson.id || ''
  const libNames: string[] = (libraries || []).map((l: any) => l.name || '')
  const gameArgs: string[] = []
  if (versionJson.arguments?.game) {
    for (const arg of versionJson.arguments.game) {
      if (typeof arg === 'string') gameArgs.push(arg)
    }
  }

  if (libNames.some(n => n.includes('org.quiltmc:quilt-loader'))) {
    const match = libNames.find(n => n.match(/org\.quiltmc:quilt-loader:([^:]+)/))
    const loaderVer = match?.match(/quilt-loader:([^:]+)/)?.[1] || ''
    const gameVer = versionJson.inheritsFrom || id.split('-')[0]
    return { modLoader: 'quilt', modLoaderVersion: loaderVer, gameVersion: gameVer }
  }

  if (libNames.some(n => n.includes('net.fabricmc:fabric-loader'))) {
    const match = libNames.find(n => n.match(/net\.fabricmc:fabric-loader:([^:]+)/))
    const loaderVer = match?.match(/fabric-loader:([^:]+)/)?.[1] || ''
    const gameVer = versionJson.inheritsFrom || id.split('-')[0]
    return { modLoader: 'fabric', modLoaderVersion: loaderVer, gameVersion: gameVer }
  }

  if (libNames.some(n => n.includes('net.neoforged'))) {
    const match = libNames.find(n => n.match(/net\.neoforged[^:]*:([^:]+):([^:]+)/))
    const loaderVer = match?.match(/:([^:]+):([^:]+)$/)?.[2] || ''
    const gameVer = versionJson.inheritsFrom || id.split('-')[0]
    return { modLoader: 'neoforge', modLoaderVersion: loaderVer, gameVersion: gameVer }
  }

  if (libNames.some(n => n.includes('net.minecraftforge'))) {
    const match = libNames.find(n => n.match(/net\.minecraftforge[^:]*:([^:]+):([^:]+)/))
    const loaderVer = match?.match(/:([^:]+):([^:]+)$/)?.[2] || ''
    const gameVer = versionJson.inheritsFrom || id.split('-')[0]
    return { modLoader: 'forge', modLoaderVersion: loaderVer, gameVersion: gameVer }
  }

  return { modLoader: 'vanilla', modLoaderVersion: '', gameVersion: id }
}

function readVersionJsonSafe(filePath: string): any | null {
  try {
    if (!fs.existsSync(filePath)) return null
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

export function scanMinecraftDirectory(dir: string): DetectedInstallation[] {
  if (!fs.existsSync(dir)) return []

  const versionsDir = path.join(dir, 'versions')
  if (!fs.existsSync(versionsDir)) return []

  const results: DetectedInstallation[] = []
  const seen = new Set<string>()

  let entries: string[]
  try {
    entries = fs.readdirSync(versionsDir)
  } catch {
    return []
  }

  for (const entry of entries) {
    const versionDir = path.join(versionsDir, entry)
    if (!fs.statSync(versionDir).isDirectory()) continue

    const jsonPath = path.join(versionDir, `${entry}.json`)
    const versionJson = readVersionJsonSafe(jsonPath)
    if (!versionJson) continue

    const libraries = versionJson.libraries || []
    const { modLoader, modLoaderVersion, gameVersion } = detectModLoader(versionJson, libraries)

    const jarPath = path.join(versionDir, `${entry}.jar`)
    const jarExists = fs.existsSync(jarPath)

    const modsDir = path.join(dir, 'mods')
    let modsCount = 0
    try {
      if (fs.existsSync(modsDir)) {
        modsCount = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar')).length
      }
    } catch {}

    const dedupeKey = `${gameVersion}-${modLoader}-${modLoaderVersion}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const displayName = modLoader === 'vanilla'
      ? `Minecraft ${gameVersion}`
      : `${modLoader.charAt(0).toUpperCase() + modLoader.slice(1)} ${gameVersion}`

    results.push({
      versionId: entry,
      gameVersion,
      modLoader,
      modLoaderVersion,
      gameDirectory: dir,
      jarExists,
      modsCount,
      name: displayName,
    })
  }

  return results.sort((a, b) => {
    if (a.modLoader === 'vanilla' && b.modLoader !== 'vanilla') return -1
    if (a.modLoader !== 'vanilla' && b.modLoader === 'vanilla') return 1
    return a.gameVersion.localeCompare(b.gameVersion)
  })
}

export function getDefaultScanPaths(): string[] {
  const paths = getAlternativePaths()
  return paths.filter(p => {
    try {
      return fs.existsSync(p) && fs.existsSync(path.join(p, 'versions'))
    } catch {
      return false
    }
  })
}

export function getMinecraftDirSuggestions(): string[] {
  const all = getAlternativePaths()
  return [...new Set(all)]
}
