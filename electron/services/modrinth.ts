import fs from 'fs'
import path from 'path'
import { createWriteStream } from 'fs'
import unzipper from 'unzipper'
import crypto from 'crypto'

const MODRINTH_API = 'https://api.modrinth.com/v2'
const CURSEFORGE_API = 'https://api.curseforge.com'
const CURSEFORGE_API_KEY = '$2a$10$bD2oKJBnqOoE8cO7uJXtjOqFfGJhKlMnOpQrStUvWxYz'

export interface ModrinthSearchResult {
  hits: ModrinthProject[]
  offset: number
  limit: number
  total_hits: number
}

export interface ModrinthProject {
  slug: string
  title: string
  description: string
  project_type: string
  downloads: number
  icon_url: string
  categories: string[]
  versions: string[]
  author: string
  date_modified: string
  gallery: string[]
  client_side: string
  server_side: string
}

export interface ModrinthProjectFull extends ModrinthProject {
  id: string
  body: string
  status: string
  team: string
  versions: string[]
  game_versions: string[]
  loaders: string[]
}

export interface ModrinthVersion {
  id: string
  name: string
  version_number: string
  version_type: 'release' | 'beta' | 'alpha'
  game_versions: string[]
  loaders: string[]
  files: ModrinthFile[]
  dependencies: ModrinthDependency[]
  date_published: string
  downloads: number
}

export interface ModrinthFile {
  hashes: { sha1?: string; sha512?: string }
  url: string
  filename: string
  primary: boolean
  size: number
}

export interface ModrinthDependency {
  version_id: string | null
  file_name: string | null
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded'
  project_id: string | null
}

export interface MrpackIndex {
  formatVersion: number
  game: string
  versionId: string
  name: string
  summary: string
  files: MrpackFile[]
  dependencies: Record<string, string>
}

export interface MrpackFile {
  path: string
  hashes: { sha1?: string; sha512?: string }
  env?: { client?: 'required' | 'unsupported' | 'optional'; server?: 'required' | 'unsupported' | 'optional' }
  downloads: string[]
  fileSize: number
}

export interface ModpackManifest {
  name: string
  version: string
  author: string
  description: string
  minecraft: { version: string; modLoaders: { id: string; primary: boolean }[] }
  files: ModpackFile[]
  overrides: string
}

export interface ModpackFile {
  projectID: number
  fileID: number
  required: boolean
}

export interface InstallModpackResult {
  mcVersion: string
  modLoader: string
  loaderVersion: string
  modCount: number
  instanceName: string
}

export class ModrinthService {
  private cacheDir: string
  private rateLimitRemaining = 600
  private rateLimitReset = 0

  constructor(userDataPath: string) {
    this.cacheDir = path.join(userDataPath, 'modrinth-cache')
    if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true })
  }

  private async apiFetch(url: string, options?: RequestInit): Promise<Response> {
    if (this.rateLimitRemaining <= 10 && Date.now() < this.rateLimitReset) {
      const waitMs = this.rateLimitReset - Date.now()
      if (waitMs > 0 && waitMs < 30000) {
        await new Promise(r => setTimeout(r, waitMs))
      }
    }

    const res = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': 'FlexoLauncher/1.0.9 (contact@flexo.lol)',
        ...options?.headers,
      },
    })

    const remaining = res.headers.get('x-ratelimit-remaining')
    const reset = res.headers.get('x-ratelimit-reset')
    if (remaining !== null) this.rateLimitRemaining = parseInt(remaining)
    if (reset !== null) this.rateLimitReset = parseInt(reset) * 1000

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '5')
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      return this.apiFetch(url, options)
    }

    return res
  }

  async searchMods(query: string, filters?: {
    categories?: string[]
    projectType?: string
    gameVersion?: string
    loader?: string
    limit?: number
    offset?: number
  }): Promise<ModrinthSearchResult> {
    const params = new URLSearchParams({
      query: query || '',
      index: 'relevance',
      limit: String(filters?.limit || 20),
      offset: String(filters?.offset || 0),
    })

    const facets: any[][] = []

    if (filters?.projectType && filters.projectType !== 'all') {
      facets.push([`project_type:${filters.projectType}`])
    }

    if (filters?.categories?.length) {
      facets.push(filters.categories.map(c => `categories:${c}`))
    }

    if (facets.length > 0) {
      params.set('facets', JSON.stringify(facets))
    }

    if (filters?.gameVersion) params.set('game_versions', JSON.stringify([filters.gameVersion]))
    if (filters?.loader) params.set('loaders', JSON.stringify([filters.loader]))

    const res = await this.apiFetch(`${MODRINTH_API}/search?${params}`)
    if (!res.ok) throw new Error(`Modrinth search failed: ${res.statusText}`)
    return res.json()
  }

  async getProject(projectId: string): Promise<ModrinthProjectFull> {
    const res = await this.apiFetch(`${MODRINTH_API}/project/${projectId}`)
    if (!res.ok) throw new Error(`Failed to fetch project: ${res.statusText}`)
    return res.json()
  }

  async getProjectVersions(projectId: string, filters?: {
    gameVersion?: string
    loader?: string
  }): Promise<ModrinthVersion[]> {
    const params = new URLSearchParams()
    if (filters?.gameVersion) params.set('game_versions', JSON.stringify([filters.gameVersion]))
    if (filters?.loader) params.set('loaders', JSON.stringify([filters.loader]))

    const res = await this.apiFetch(`${MODRINTH_API}/project/${projectId}/version?${params}`)
    if (!res.ok) throw new Error(`Failed to fetch versions: ${res.statusText}`)
    return res.json()
  }

  async getMultipleProjects(projectIds: string[]): Promise<ModrinthProjectFull[]> {
    if (projectIds.length === 0) return []
    const ids = JSON.stringify(projectIds)
    const res = await this.apiFetch(`${MODRINTH_API}/projects?ids=${ids}`)
    if (!res.ok) throw new Error(`Failed to fetch projects: ${res.statusText}`)
    return res.json()
  }

  async getMultipleVersions(versionIds: string[]): Promise<ModrinthVersion[]> {
    if (versionIds.length === 0) return []
    const ids = JSON.stringify(versionIds)
    const res = await this.apiFetch(`${MODRINTH_API}/versions?ids=${ids}`)
    if (!res.ok) throw new Error(`Failed to fetch versions: ${res.statusText}`)
    return res.json()
  }

  async downloadMod(version: ModrinthVersion, targetDir: string, onProgress?: (progress: number) => void): Promise<string> {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

    const primaryFile = version.files.find(f => f.primary) || version.files[0]
    if (!primaryFile) throw new Error('No files in version')

    const filePath = path.join(targetDir, primaryFile.filename)
    await this.downloadFile(primaryFile.url, filePath, primaryFile.hashes.sha1, onProgress)
    return filePath
  }

  async resolveDependencies(
    versionId: string,
    gameVersion: string,
    loader: string,
    visited: Set<string> = new Set()
  ): Promise<{ projectId: string; versionId: string }[]> {
    if (visited.has(versionId)) return []
    visited.add(versionId)

    const versions = await this.getMultipleVersions([versionId])
    const version = versions[0]
    if (!version) return []

    const resolved: { projectId: string; versionId: string }[] = []

    for (const dep of version.dependencies) {
      if (dep.dependency_type === 'incompatible' || dep.dependency_type === 'embedded') continue
      if (!dep.project_id) continue

      try {
        const depVersions = await this.getProjectVersions(dep.project_id, { gameVersion, loader })
        const compatible = depVersions.find(v =>
          v.game_versions.includes(gameVersion) &&
          v.loaders.includes(loader)
        )

        if (compatible) {
          resolved.push({ projectId: dep.project_id, versionId: compatible.id })
          const subDeps = await this.resolveDependencies(compatible.id, gameVersion, loader, visited)
          resolved.push(...subDeps)
        }
      } catch (e) {
        console.warn(`Failed to resolve dependency ${dep.project_id}:`, e)
      }
    }

    return resolved
  }

  async installModpack(modpackUrl: string, instanceDir: string, onProgress?: (msg: string) => void): Promise<InstallModpackResult> {
    const tmpDir = path.join(this.cacheDir, 'tmp-modpack-' + Date.now())
    fs.mkdirSync(tmpDir, { recursive: true })

    try {
      onProgress?.('Downloading modpack...')
      const zipPath = path.join(tmpDir, 'modpack.zip')
      await this.downloadFile(modpackUrl, zipPath)

      onProgress?.('Extracting modpack...')
      const extractDir = path.join(tmpDir, 'extracted')
      await this.extractZip(zipPath, extractDir)

      const mrpackIndex = path.join(extractDir, 'modrinth.index.json')
      const cfManifest = path.join(extractDir, 'manifest.json')

      if (fs.existsSync(mrpackIndex)) {
        return await this.installMrpack(extractDir, instanceDir, onProgress)
      } else if (fs.existsSync(cfManifest)) {
        return await this.installCurseForgeManifest(extractDir, instanceDir, onProgress)
      } else {
        throw new Error('Invalid modpack: no modrinth.index.json or manifest.json found')
      }
    } finally {
      this.cleanupDir(tmpDir)
    }
  }

  private async installMrpack(extractDir: string, instanceDir: string, onProgress?: (msg: string) => void): Promise<InstallModpackResult> {
    const indexRaw = fs.readFileSync(path.join(extractDir, 'modrinth.index.json'), 'utf-8')
    const index: MrpackIndex = JSON.parse(indexRaw)

    const mcVersion = index.game || '1.21.4'
    let modLoader = 'vanilla'
    let loaderVersion = ''

    if (index.dependencies) {
      if (index.dependencies.fabric) {
        modLoader = 'fabric'
        loaderVersion = index.dependencies.fabric
      } else if (index.dependencies.forge) {
        modLoader = 'forge'
        loaderVersion = index.dependencies.forge
      } else if (index.dependencies.neoforge) {
        modLoader = 'neoforge'
        loaderVersion = index.dependencies.neoforge
      } else if (index.dependencies['quilt-loader']) {
        modLoader = 'quilt'
        loaderVersion = index.dependencies['quilt-loader']
      }
    }

    const installs = index.files.filter(f => {
      if (f.env?.client === 'unsupported') return false
      if (f.env?.client === 'required' || !f.env?.client) return true
      if (f.env?.client === 'optional') return true
      return true
    })

    let installed = 0
    const total = installs.length + 1

    onProgress?.(`Installing ${installs.length} mod files...`)

    for (const file of installs) {
      try {
        onProgress?.(`Installing mod ${installed + 1}/${installs.length}: ${path.basename(file.path)}`)
        const targetPath = path.join(instanceDir, file.path)
        const targetDir = path.dirname(targetPath)
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

        if (file.downloads.length > 0) {
          await this.downloadFile(file.downloads[0], targetPath, file.hashes.sha1)
        }
        installed++
      } catch (e) {
        console.warn(`Failed to install mrpack file ${file.path}:`, e)
      }
    }

    onProgress?.('Copying override files...')
    const overridesDir = path.join(extractDir, 'overrides')
    if (fs.existsSync(overridesDir)) {
      this.copyDirSync(overridesDir, instanceDir)
    }

    return {
      mcVersion,
      modLoader,
      loaderVersion,
      modCount: installed,
      instanceName: index.name || 'Modpack',
    }
  }

  private async installCurseForgeManifest(extractDir: string, instanceDir: string, onProgress?: (msg: string) => void): Promise<InstallModpackResult> {
    const manifestRaw = fs.readFileSync(path.join(extractDir, 'manifest.json'), 'utf-8')
    const manifest: ModpackManifest = JSON.parse(manifestRaw)

    onProgress?.('Copying overrides...')
    const overridesDir = path.join(extractDir, manifest.overrides || 'overrides')
    if (fs.existsSync(overridesDir)) {
      this.copyDirSync(overridesDir, instanceDir)
    }

    let modLoader = 'vanilla'
    let loaderVersion = ''
    if (manifest.minecraft?.modLoaders?.length) {
      const loader = manifest.minecraft.modLoaders.find(l => l.primary) || manifest.minecraft.modLoaders[0]
      const parts = loader.id.split('-')
      modLoader = parts[0]
      loaderVersion = parts.slice(1).join('-')
    }

    onProgress?.(`Installing ${manifest.files?.length || 0} mods...`)
    const modsDir = path.join(instanceDir, 'mods')
    fs.mkdirSync(modsDir, { recursive: true })

    let installed = 0
    for (const file of manifest.files || []) {
      try {
        onProgress?.(`Installing mod ${installed + 1}/${manifest.files.length}...`)
        await this.downloadCurseForgeMod(file.projectID, file.fileID, modsDir)
        installed++
      } catch (e) {
        console.warn(`Failed to install CurseForge mod ${file.projectID}/${file.fileID}:`, e)
      }
    }

    return {
      mcVersion: manifest.minecraft?.version || '1.21.4',
      modLoader,
      loaderVersion,
      modCount: installed,
      instanceName: manifest.name || 'Modpack',
    }
  }

  async downloadCurseForgeMod(projectId: number, fileId: number, targetDir: string): Promise<string> {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

    try {
      const res = await fetch(`${CURSEFORGE_API}/v1/mods/${projectId}/files/${fileId}`, {
        headers: { 'x-api-key': CURSEFORGE_API_KEY },
      })

      if (res.ok) {
        const data = await res.json()
        const file = data.data
        if (file?.downloadUrl) {
          const filePath = path.join(targetDir, file.fileName)
          await this.downloadFile(file.downloadUrl, filePath)
          return filePath
        }
      }
    } catch (e) {
      console.warn('CurseForge API failed, trying Modrinth fallback:', e)
    }

    return this.downloadModFromModrinthByProject(projectId, targetDir)
  }

  private async downloadModFromModrinthByProject(projectId: number, targetDir: string): Promise<string> {
    const res = await this.apiFetch(`${MODRINTH_API}/project/${projectId}/version`)
    if (!res.ok) throw new Error('Failed to fetch mod versions from Modrinth')
    const versions: ModrinthVersion[] = await res.json()
    if (versions.length === 0) throw new Error(`No versions found for project ${projectId} on Modrinth`)
    return this.downloadMod(versions[0], targetDir)
  }

  async downloadModFile(url: string, filename: string, targetDir: string): Promise<string> {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
    const filePath = path.join(targetDir, filename)
    await this.downloadFile(url, filePath)
    return filePath
  }

  private async extractZip(zipPath: string, destDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: destDir }))
        .on('close', resolve)
        .on('error', reject)
    })
  }

  private async downloadFile(
    url: string,
    destPath: string,
    expectedSha1?: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Download failed: ${url} (${res.status})`)

        const contentLength = Number(res.headers.get('content-length') || 0)
        const fileStream = createWriteStream(destPath)
        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

        const hash = crypto.createHash('sha1')
        let downloaded = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fileStream.write(value)
          hash.update(value)
          downloaded += value.length

          if (contentLength > 0 && onProgress) {
            onProgress(Math.round((downloaded / contentLength) * 100))
          }
        }
        fileStream.end()

        await new Promise<void>((resolve, reject) => {
          fileStream.on('finish', resolve)
          fileStream.on('error', reject)
        })

        if (expectedSha1) {
          const actual = hash.digest('hex')
          if (actual !== expectedSha1) {
            fs.unlinkSync(destPath)
            throw new Error(`SHA1 mismatch: expected ${expectedSha1}, got ${actual}`)
          }
        }

        return
      } catch (err: any) {
        lastError = err
        if (attempt < maxRetries) {
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
          await new Promise(r => setTimeout(r, 1000 * attempt))
          continue
        }
      }
    }

    throw lastError || new Error('Download failed after retries')
  }

  private copyDirSync(src: string, dest: string) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)
      if (entry.isDirectory()) {
        this.copyDirSync(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }

  private cleanupDir(dir: string) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {}
  }
}
