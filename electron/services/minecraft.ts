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

  async getVersionJson(versionId: string, gameDir?: string): Promise<VersionJson> {
    const manifest = await this.getVersionManifest()
    const versionEntry = manifest.versions.find((v) => v.id === versionId)

    const cachePath = path.join(this.cacheDir, 'versions', `${versionId}.json`)
    this.ensureDir(path.dirname(cachePath))

    if (fs.existsSync(cachePath)) {
      const cached: VersionJson = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
      if (cached.inheritsFrom) {
        const parent = await this.getVersionJson(cached.inheritsFrom, gameDir)
        return this.mergeVersionJsons(parent, cached)
      }
      return cached
    }

    if (versionEntry) {
      const res = await fetch(versionEntry.url)
      if (!res.ok) throw new Error(`Failed to fetch version JSON for ${versionId}`)
      const versionJson: VersionJson = await res.json()
      fs.writeFileSync(cachePath, JSON.stringify(versionJson))

      if (versionJson.inheritsFrom) {
        const parent = await this.getVersionJson(versionJson.inheritsFrom, gameDir)
        return this.mergeVersionJsons(parent, versionJson)
      }
      return versionJson
    }

    if (gameDir) {
      const localPath = path.join(gameDir, 'versions', versionId, `${versionId}.json`)
      if (fs.existsSync(localPath)) {
        const localJson: VersionJson = JSON.parse(fs.readFileSync(localPath, 'utf-8'))
        fs.writeFileSync(cachePath, JSON.stringify(localJson))

        if (localJson.inheritsFrom) {
          const parent = await this.getVersionJson(localJson.inheritsFrom, gameDir)
          return this.mergeVersionJsons(parent, localJson)
        }
        return localJson
      }
    }

    throw new Error(`Version ${versionId} not found`)
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

  // buildClasspath, buildJvmArgs, buildGameArgs removed — @xmcl/core handles launch

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
