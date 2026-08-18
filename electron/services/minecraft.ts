import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'
import crypto from 'crypto'

const VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'
const MOJANG_RESOURCES_URL = 'https://resources.download.minecraft.net'

export interface MinecraftVersion {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string
  time: string
  releaseTime: string
}

export interface VersionManifest {
  latest: { release: string; snapshot: string }
  versions: MinecraftVersion[]
}

export interface VersionJson {
  id: string
  arguments?: { game?: any[]; jvm?: any[] }
  mainClass: string
  mainClassClient?: string
  inheritsFrom?: string
  libraries: LibraryInfo[]
  assets: string
  assetIndex?: { id: string; sha1: string; size: number; url: string }
  downloads: {
    client: { sha1: string; size: number; url: string }
    server?: { sha1: string; size: number; url: string }
  }
  javaVersion?: { majorVersion: number; component: string }
  logging?: any
}

export interface LibraryInfo {
  name: string
  url?: string
  downloads?: {
    artifact?: { path: string; sha1: string; size: number; url: string }
    classifiers?: Record<string, { path: string; sha1: string; size: number; url: string }>
  }
  natives?: Record<string, string>
  extract?: { exclude?: string[] }
  rules?: any[]
}

export interface DownloadProgress {
  total: number
  downloaded: number
  currentFile: string
  speed: number
  percent: number
}

export class MinecraftService {
  private cacheDir: string
  private manifest: VersionManifest | null = null

  constructor(userDataPath: string) {
    this.cacheDir = path.join(userDataPath, 'minecraft-cache')
    this.ensureDir(this.cacheDir)
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  async getVersionManifest(): Promise<VersionManifest> {
    if (this.manifest) return this.manifest

    const cachePath = path.join(this.cacheDir, 'version_manifest.json')
    if (fs.existsSync(cachePath)) {
      const age = Date.now() - fs.statSync(cachePath).mtimeMs
      if (age < 3600000) {
        this.manifest = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
        return this.manifest!
      }
    }

    const res = await fetch(VERSION_MANIFEST_URL)
    if (!res.ok) throw new Error(`Failed to fetch version manifest: ${res.statusText}`)
    this.manifest = await res.json()
    fs.writeFileSync(cachePath, JSON.stringify(this.manifest))
    return this.manifest!
  }

  async getVersionJson(versionId: string): Promise<VersionJson> {
    const manifest = await this.getVersionManifest()
    const versionEntry = manifest.versions.find((v) => v.id === versionId)
    if (!versionEntry) throw new Error(`Version ${versionId} not found`)

    const cachePath = path.join(this.cacheDir, 'versions', `${versionId}.json`)
    this.ensureDir(path.dirname(cachePath))

    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    }

    const res = await fetch(versionEntry.url)
    if (!res.ok) throw new Error(`Failed to fetch version JSON for ${versionId}`)
    const versionJson: VersionJson = await res.json()
    fs.writeFileSync(cachePath, JSON.stringify(versionJson))

    if (versionJson.inheritsFrom) {
      const parent = await this.getVersionJson(versionJson.inheritsFrom)
      return this.mergeVersionJsons(parent, versionJson)
    }

    return versionJson
  }

  private mergeVersionJsons(parent: VersionJson, child: VersionJson): VersionJson {
    const mergedLibs = [...(parent.libraries || [])]
    for (const lib of child.libraries || []) {
      const existing = mergedLibs.findIndex((l) => l.name === lib.name)
      if (existing >= 0) {
        mergedLibs[existing] = lib
      } else {
        mergedLibs.push(lib)
      }
    }

    const gameArgs = [
      ...(parent.arguments?.game || []),
      ...(child.arguments?.game || []),
    ]
    const jvmArgs = [
      ...(parent.arguments?.jvm || []),
      ...(child.arguments?.jvm || []),
    ]

    return {
      ...parent,
      ...child,
      libraries: mergedLibs,
      arguments: {
        game: gameArgs,
        jvm: jvmArgs,
      },
      mainClass: child.mainClass || parent.mainClass,
      assetIndex: child.assetIndex || parent.assetIndex,
      assets: child.assets || parent.assets,
    }
  }

  async downloadClientJar(versionJson: VersionJson, instanceDir: string): Promise<string> {
    const versionsDir = path.join(instanceDir, 'versions', versionJson.id)
    this.ensureDir(versionsDir)

    const jarPath = path.join(versionsDir, `${versionJson.id}.jar`)
    if (fs.existsSync(jarPath)) return jarPath

    const dl = versionJson.downloads.client
    await this.downloadFile(dl.url, jarPath, dl.sha1)
    return jarPath
  }

  async downloadAssetIndex(versionJson: VersionJson, instanceDir: string): Promise<any> {
    if (!versionJson.assetIndex) return {}

    const assetsDir = path.join(instanceDir, 'assets', 'indexes')
    this.ensureDir(assetsDir)

    const indexPath = path.join(assetsDir, `${versionJson.assetIndex.id}.json`)
    if (fs.existsSync(indexPath)) {
      return JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
    }

    await this.downloadFile(versionJson.assetIndex.url, indexPath, versionJson.assetIndex.sha1)
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
  }

  async downloadAssets(
    assetIndex: any,
    instanceDir: string,
    onProgress?: (p: DownloadProgress) => void
  ): Promise<void> {
    const assetsDir = path.join(instanceDir, 'assets', 'objects')
    this.ensureDir(assetsDir)

    const objects = assetIndex.objects || {}
    const entries = Object.entries(objects) as [string, { hash: string; size: number }][]
    let downloaded = 0
    const total = entries.length

    const concurrency = 8
    const queue = [...entries]

    const worker = async () => {
      while (queue.length > 0) {
        const [name, info] = queue.shift()!
        const hash = info.hash
        const prefix = hash.substring(0, 2)
        const dir = path.join(assetsDir, prefix)
        this.ensureDir(dir)

        const filePath = path.join(dir, hash)
        if (!fs.existsSync(filePath)) {
          const url = `${MOJANG_RESOURCES_URL}/${prefix}/${hash}`
          await this.downloadFile(url, filePath)
        }

        downloaded++
        onProgress?.({
          total,
          downloaded,
          currentFile: name,
          speed: 0,
          percent: Math.round((downloaded / total) * 100),
        })
      }
    }

    const workers = Array(concurrency).fill(null).map(() => worker())
    await Promise.all(workers)
  }

  async downloadLibraries(
    versionJson: VersionJson,
    instanceDir: string,
    onProgress?: (p: DownloadProgress) => void
  ): Promise<string[]> {
    const librariesDir = path.join(instanceDir, 'libraries')
    this.ensureDir(librariesDir)

    const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
    const resolvedLibs: string[] = []
    let downloaded = 0

    const toDownload: { lib: LibraryInfo; targetPath: string }[] = []

    for (const lib of versionJson.libraries) {
      if (lib.rules) {
        if (!this.evaluateRules(lib.rules)) continue
      }

      if (lib.natives) {
        const nativeKey = lib.natives[platform]
        if (nativeKey && lib.downloads?.classifiers?.[nativeKey]) {
          const classifier = lib.downloads.classifiers[nativeKey]
          const targetPath = path.join(librariesDir, classifier.path)
          toDownload.push({ lib, targetPath })
          resolvedLibs.push(targetPath)
        }
        continue
      }

      if (lib.downloads?.artifact) {
        const artifact = lib.downloads.artifact
        const targetPath = path.join(librariesDir, artifact.path)
        toDownload.push({ lib, targetPath })
        resolvedLibs.push(targetPath)
      } else if (lib.url) {
        const parts = lib.name.split(':')
        const libPath = parts[0].replace(/\./g, '/') + '/' + parts[1] + '/' + parts[2] + '/' + parts[1] + '-' + parts[2] + '.jar'
        const targetPath = path.join(librariesDir, libPath)
        const url = lib.url.endsWith('/') ? lib.url : lib.url + '/'
        toDownload.push({ lib: { ...lib, downloads: { artifact: { path: libPath, sha1: '', size: 0, url: url + libPath } } }, targetPath })
        resolvedLibs.push(targetPath)
      }
    }

    const total = toDownload.length
    const concurrency = 8
    const queue = [...toDownload]

    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift()!
        const dir = path.dirname(item.targetPath)
        this.ensureDir(dir)

        if (!fs.existsSync(item.targetPath)) {
          const artifact = item.lib.downloads?.artifact
          if (artifact?.url) {
            await this.downloadFile(artifact.url, item.targetPath, artifact.sha1)
          }
        }

        downloaded++
        onProgress?.({
          total,
          downloaded,
          currentFile: item.lib.name,
          speed: 0,
          percent: total > 0 ? Math.round((downloaded / total) * 100) : 100,
        })
      }
    }

    const workers = Array(Math.min(concurrency, total)).fill(null).map(() => worker())
    await Promise.all(workers)

    return resolvedLibs
  }

  private evaluateRules(rules: any[]): boolean {
    let allowed = false
    for (const rule of rules) {
      if (rule.action === 'allow') {
        let matches = true
        if (rule.os && !this.matchesOS(rule.os)) matches = false
        if (rule.features && !this.matchesFeatures(rule.features)) matches = false
        if (matches) allowed = true
      } else if (rule.action === 'deny') {
        let matches = true
        if (rule.os && !this.matchesOS(rule.os)) matches = false
        if (rule.features && !this.matchesFeatures(rule.features)) matches = false
        if (matches) return false
      }
    }
    return allowed
  }

  private matchesFeatures(features: Record<string, { value: boolean }>): boolean {
    for (const [key, expected] of Object.entries(features)) {
      if ((this as any)[`feature_${key}`] !== expected.value) return false
    }
    return true
  }

  private matchesOS(os: any): boolean {
    if (os.name) {
      const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
      if (os.name !== platform) return false
    }
    if (os.arch) {
      if (os.arch !== process.arch) return false
    }
    return true
  }

  buildClasspath(versionJson: VersionJson, librariesDir: string): string {
    const separator = process.platform === 'win32' ? ';' : ':'
    const libs: string[] = []

    for (const lib of versionJson.libraries) {
      if (lib.rules && !this.evaluateRules(lib.rules)) continue

      if (lib.natives) {
        const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
        const nativeKey = lib.natives[platform]
        if (nativeKey && lib.downloads?.classifiers?.[nativeKey]) {
          libs.push(path.join(librariesDir, lib.downloads.classifiers[nativeKey].path))
        }
        continue
      }

      if (lib.downloads?.artifact) {
        libs.push(path.join(librariesDir, lib.downloads.artifact.path))
      } else if (lib.url) {
        const parts = lib.name.split(':')
        const libPath = parts[0].replace(/\./g, '/') + '/' + parts[1] + '/' + parts[2] + '/' + parts[1] + '-' + parts[2] + '.jar'
        libs.push(path.join(librariesDir, libPath))
      }
    }

    return libs.join(separator)
  }

  buildGameArgs(
    versionJson: VersionJson,
    opts: {
      username: string
      uuid: string
      accessToken: string
      userType: string
      gameDir: string
      assetsDir: string
      properties?: any[]
    }
  ): string[] {
    const args: string[] = []

    const placeholders: Record<string, string> = {
      '${auth_player_name}': opts.username,
      '${auth_session}': opts.accessToken,
      '${auth_player_uuid}': opts.uuid,
      '${auth_uuid}': opts.uuid,
      '${auth_access_token}': opts.accessToken,
      '${user_properties}': JSON.stringify(opts.properties || []),
      '${user_type}': opts.userType,
      '${version_name}': versionJson.id,
      '${game_directory}': opts.gameDir,
      '${assets_root}': opts.assetsDir,
      '${assets_index_name}': versionJson.assets || '',
      '${assets_index_num}': versionJson.assets || '',
      '${version_type}': 'Flexo',
      '${natives_directory}': path.join(opts.gameDir, 'versions', versionJson.id, 'natives'),
      '${launcher_name}': 'Flexo',
      '${launcher_version}': '1.0.0',
      '${class_path}': '',
      '${classpath}': '',
      '${clientid}': '',
      '${auth_xuid}': '',
      '${resolution_width}': '854',
      '${resolution_height}': '480',
      '${quickPlayPath}': '',
      '${quickPlaySingleplayer}': '',
      '${quickPlayMultiplayer}': '',
      '${quickPlayRealms}': '',
    }

    const gameArgs = versionJson.arguments?.game || []
    for (const arg of gameArgs) {
      if (typeof arg === 'string') {
        let resolved = arg
        for (const [key, value] of Object.entries(placeholders)) {
          resolved = resolved.replaceAll(key, value)
        }
        if (resolved && !resolved.includes('${')) {
          args.push(resolved)
        }
      } else if (arg.rules && this.evaluateRules(arg.rules)) {
        if (typeof arg.value === 'string') {
          let resolved = arg.value
          for (const [key, value] of Object.entries(placeholders)) {
            resolved = resolved.replaceAll(key, value)
          }
          if (resolved && !resolved.includes('${')) args.push(resolved)
        } else if (Array.isArray(arg.value)) {
          for (const v of arg.value) {
            let resolved = v
            for (const [key, value] of Object.entries(placeholders)) {
              resolved = resolved.replaceAll(key, value)
            }
            if (resolved && !resolved.includes('${')) args.push(resolved)
          }
        }
      }
    }

    return this.filterGameArgs(args)
  }

  private filterGameArgs(args: string[]): string[] {
    const skipFlags = new Set(['--demo', '--clientId', '--xuid'])
    const result: string[] = []

    for (const arg of args) {
      if (!arg || arg === '""') continue
      if (skipFlags.has(arg)) continue
      if (arg.startsWith('--quickPlay')) continue
      result.push(arg)
    }

    return result
  }

  buildJvmArgs(
    versionJson: VersionJson,
    opts: {
      classpath: string
      gameDir: string
      nativesDir: string
      maxMemory: number
      minMemory?: number
      javaPath: string
      authlibInjectorPath?: string
      authlibInjectorUrl?: string
      jvmArgs?: string[]
    }
  ): string[] {
    const args: string[] = []

    if (opts.authlibInjectorPath && opts.authlibInjectorUrl) {
      args.push(`-javaagent:${opts.authlibInjectorPath}=${opts.authlibInjectorUrl}`)
    }

    args.push(`-Xmx${opts.maxMemory}M`)
    if (opts.minMemory) args.push(`-Xms${opts.minMemory}M`)

    if (opts.jvmArgs) args.push(...opts.jvmArgs)

    args.push(
      '-Djava.net.preferIPv4Stack=true',
      `-Dminecraft.launcher.brand=Flexo`,
      `-Dminecraft.launcher.version=1.0.0`,
    )

    const jvmArgs = versionJson.arguments?.jvm || []
    for (const arg of jvmArgs) {
      if (typeof arg === 'string') {
        let resolved = arg
          .replaceAll('${natives_directory}', opts.nativesDir)
          .replaceAll('${launcher_name}', 'Flexo')
          .replaceAll('${launcher_version}', '1.0.0')
          .replaceAll('${class_path}', opts.classpath)
          .replaceAll('${classpath}', opts.classpath)
          .replaceAll('${library_directory}', path.dirname(opts.classpath.split(process.platform === 'win32' ? ';' : ':')[0] || ''))
        args.push(resolved)
      } else if (arg.rules && this.evaluateRules(arg.rules)) {
        if (typeof arg.value === 'string') args.push(arg.value)
        else if (Array.isArray(arg.value)) args.push(...arg.value)
      }
    }

    return args
  }

  private async downloadFile(url: string, destPath: string, expectedSha1?: string): Promise<void> {
    const destDir = path.dirname(destPath)
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

    const tempPath = destPath + '.tmp'
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Download failed: ${url} (${res.status})`)

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const hash = crypto.createHash('sha1')
    const chunks: Buffer[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(Buffer.from(value))
      hash.update(value)
    }
    const buffer = Buffer.concat(chunks)

    fs.writeFileSync(tempPath, buffer)

    if (expectedSha1) {
      const actual = hash.digest('hex')
      if (actual !== expectedSha1) {
        try { fs.unlinkSync(tempPath) } catch {}
        throw new Error(`SHA1 mismatch for ${path.basename(destPath)}: expected ${expectedSha1}, got ${actual}`)
      }
    }

    if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
    fs.renameSync(tempPath, destPath)
  }
}
