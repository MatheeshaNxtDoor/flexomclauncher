import fs from 'fs'
import path from 'path'
import { createWriteStream } from 'fs'
import crypto from 'crypto'

const AUTHLIB_INJECTOR_VERSIONS_URL = 'https://authlib-injector.yushi.moe/package/meta/versions.json'
const AUTHLIB_INJECTOR_BASE_URL = 'https://authlib-injector.yushi.moe/artifact'

export interface AuthlibVersion {
  versionNumber: string
  downloadUrl: string
  sha256Hash: string
}

export class AuthlibService {
  private cacheDir: string

  constructor(userDataPath: string) {
    this.cacheDir = path.join(userDataPath, 'authlib-cache')
    if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true })
  }

  async getLatestVersion(): Promise<AuthlibVersion> {
    const cachePath = path.join(this.cacheDir, 'versions.json')
    if (fs.existsSync(cachePath)) {
      const age = Date.now() - fs.statSync(cachePath).mtimeMs
      if (age < 86400000) {
        return JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
      }
    }

    const res = await fetch(AUTHLIB_INJECTOR_VERSIONS_URL)
    if (!res.ok) throw new Error(`Failed to fetch authlib versions: ${res.statusText}`)
    const versions = await res.json()

    const latest = versions.sort((a: any, b: any) =>
      new Date(b.buildTime).getTime() - new Date(a.buildTime).getTime()
    )[0]

    const result: AuthlibVersion = {
      versionNumber: latest.versionNumber,
      downloadUrl: latest.downloadUrl,
      sha256Hash: latest.sha256Hash,
    }

    fs.writeFileSync(cachePath, JSON.stringify(result))
    return result
  }

  async downloadAuthlibInjector(): Promise<string> {
    const version = await this.getLatestVersion()
    const jarName = `authlib-injector-${version.versionNumber}.jar`
    const jarPath = path.join(this.cacheDir, jarName)

    if (fs.existsSync(jarPath)) {
      return jarPath
    }

    await this.downloadFile(version.downloadUrl, jarPath, version.sha256Hash)
    return jarPath
  }

  private async downloadFile(url: string, destPath: string, expectedSha256?: string): Promise<void> {
    const tempPath = destPath + '.tmp'
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Download failed: ${url} (${res.status})`)

    const fileStream = createWriteStream(tempPath)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const hash = crypto.createHash('sha256')
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      fileStream.write(value)
      hash.update(value)
    }
    fileStream.end()

    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve)
      fileStream.on('error', reject)
    })

    if (expectedSha256) {
      const actual = hash.digest('hex')
      if (actual !== expectedSha256) {
        fs.unlinkSync(tempPath)
        throw new Error(`SHA256 mismatch: expected ${expectedSha256}, got ${actual}`)
      }
    }

    fs.renameSync(tempPath, destPath)
  }
}
