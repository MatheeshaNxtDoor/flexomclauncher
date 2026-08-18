import fs from 'fs'
import path from 'path'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import unzipper from 'unzipper'

const MODRINTH_API = 'https://api.modrinth.com/v2'
const CURSEFORGE_API = 'https://api.curseforge.com'

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

export class ModrinthService {
  private cacheDir: string

  constructor(userDataPath: string) {
    this.cacheDir = path.join(userDataPath, 'modrinth-cache')
    if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true })
  }

  async searchMods(query: string, filters?: {
    categories?: string[]
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

    if (filters?.categories?.length) {
      params.set('facets', JSON.stringify([filters.categories.map(c => `categories:${c}`)]))
    }

    if (filters?.gameVersion) params.set('game_versions', `["${filters.gameVersion}"]`)
    if (filters?.loader) params.set('loaders', `["${filters.loader}"]`)

    const res = await fetch(`${MODRINTH_API}/search?${params}`)
    if (!res.ok) throw new Error(`Modrinth search failed: ${res.statusText}`)
    return res.json()
  }

  async getProject(projectId: string): Promise<ModrinthProjectFull> {
    const res = await fetch(`${MODRINTH_API}/project/${projectId}`)
    if (!res.ok) throw new Error(`Failed to fetch project: ${res.statusText}`)
    return res.json()
  }

  async getProjectVersions(projectId: string, filters?: {
    gameVersion?: string
    loader?: string
  }): Promise<ModrinthVersion[]> {
    const params = new URLSearchParams()
    if (filters?.gameVersion) params.set('game_versions', `["${filters.gameVersion}"]`)
    if (filters?.loader) params.set('loaders', `["${filters.loader}"]`)

    const res = await fetch(`${MODRINTH_API}/project/${projectId}/version?${params}`)
    if (!res.ok) throw new Error(`Failed to fetch versions: ${res.statusText}`)
    return res.json()
  }

  async downloadMod(version: ModrinthVersion, targetDir: string): Promise<string> {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

    const primaryFile = version.files.find(f => f.primary) || version.files[0]
    if (!primaryFile) throw new Error('No files in version')

    const filePath = path.join(targetDir, primaryFile.filename)
    await this.downloadFile(primaryFile.url, filePath, primaryFile.hashes.sha1)
    return filePath
  }

  async installModpack(modpackUrl: string, instanceDir: string, onProgress?: (msg: string) => void): Promise<{
    mcVersion: string
    modLoader: string
    loaderVersion: string
    modCount: number
  }> {
    const tmpDir = path.join(this.cacheDir, 'tmp-modpack-' + Date.now())
    fs.mkdirSync(tmpDir, { recursive: true })

    onProgress?.('Downloading modpack...')
    const zipPath = path.join(tmpDir, 'modpack.zip')
    await this.downloadFile(modpackUrl, zipPath)

    onProgress?.('Extracting modpack...')
    await this.extractZip(zipPath, tmpDir)

    const manifestPath = path.join(tmpDir, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Invalid modpack: no manifest.json found')
    }

    const manifest: ModpackManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

    onProgress?.('Copying overrides...')
    const overridesDir = path.join(tmpDir, manifest.overrides || 'overrides')
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

    onProgress?.('Installing mods...')
    const modsDir = path.join(instanceDir, 'mods')
    fs.mkdirSync(modsDir, { recursive: true })

    let installed = 0
    for (const file of manifest.files || []) {
      try {
        onProgress?.(`Installing mod ${installed + 1}/${manifest.files.length}...`)
        await this.downloadCurseForgeMod(file.projectID, file.fileID, modsDir)
        installed++
      } catch (e) {
        console.error(`Failed to install mod ${file.projectID}/${file.fileID}:`, e)
      }
    }

    this.cleanupDir(tmpDir)

    return {
      mcVersion: manifest.minecraft.version,
      modLoader,
      loaderVersion,
      modCount: installed,
    }
  }

  async downloadCurseForgeMod(projectId: number, fileId: number, targetDir: string): Promise<string> {
    const res = await fetch(`https://api.curseforge.com/v1/mods/${projectId}/files/${fileId}`, {
      headers: {
        'x-api-key': '$2a$10$' + 'bD2oKJBnqOoE8cO7uJXtjOqFfGJhKlMnOpQrStUvWxYz',
      },
    })

    if (!res.ok) {
      return this.downloadModFromModrinth(projectId, fileId, targetDir)
    }

    const data = await res.json()
    const file = data.data
    if (!file?.downloadUrl) throw new Error('No download URL')

    const filePath = path.join(targetDir, file.fileName)
    await this.downloadFile(file.downloadUrl, filePath)
    return filePath
  }

  private async downloadModFromModrinth(projectId: number, fileId: number, targetDir: string): Promise<string> {
    const modrinthRes = await fetch(`${MODRINTH_API}/project/${projectId}/version`)
    if (!modrinthRes.ok) throw new Error('Failed to fetch mod versions from Modrinth')
    const versions: ModrinthVersion[] = await modrinthRes.json()
    const version = versions.find(v => v.id === String(fileId))
    if (!version) throw new Error(`Version ${fileId} not found`)
    return this.downloadMod(version, targetDir)
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

  private async downloadFile(url: string, destPath: string, expectedSha1?: string): Promise<void> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Download failed: ${url} (${res.status})`)

    const fileStream = createWriteStream(destPath)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    let sha1: any = null
    if (expectedSha1) {
      const crypto = await import('crypto')
      sha1 = crypto.createHash('sha1')
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      fileStream.write(value)
      sha1?.update(value)
    }
    fileStream.end()

    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve)
      fileStream.on('error', reject)
    })

    if (expectedSha1 && sha1) {
      const actual = sha1.digest('hex')
      if (actual !== expectedSha1) {
        fs.unlinkSync(destPath)
        throw new Error(`SHA1 mismatch: expected ${expectedSha1}, got ${actual}`)
      }
    }
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
