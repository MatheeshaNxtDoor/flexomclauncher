import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const AUTHLIB_LATEST_URL = 'https://authlib-injector.yushi.moe/artifact/latest.json'

export interface AuthlibVersion {
  version: string
  download_url: string
  sha256: string
}

export class AuthlibService {
  private cacheDir: string

  constructor(userDataPath: string) {
    this.cacheDir = path.join(userDataPath, 'authlib-cache')
    if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true })
  }

  async getLatestVersion(): Promise<AuthlibVersion> {
    const cachePath = path.join(this.cacheDir, 'latest.json')
    if (fs.existsSync(cachePath)) {
      const age = Date.now() - fs.statSync(cachePath).mtimeMs
      if (age < 86400000) {
        return JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
      }
    }

    const res = await fetch(AUTHLIB_LATEST_URL)
    if (!res.ok) throw new Error(`Failed to fetch authlib-injector latest version: ${res.statusText}`)
    const data = await res.json()

    const result: AuthlibVersion = {
      version: data.version,
      download_url: data.download_url,
      sha256: data.checksums?.sha256 || '',
    }

    fs.writeFileSync(cachePath, JSON.stringify(result))
    return result
  }

  async downloadAuthlibInjector(): Promise<string> {
    const version = await this.getLatestVersion()
    const jarName = `authlib-injector-${version.version}.jar`
    const jarPath = path.join(this.cacheDir, jarName)

    if (fs.existsSync(jarPath)) {
      return jarPath
    }

    const res = await fetch(version.download_url)
    if (!res.ok) throw new Error(`Failed to download authlib-injector: ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())

    if (version.sha256) {
      const actual = crypto.createHash('sha256').update(buffer).digest('hex')
      if (actual !== version.sha256) {
        throw new Error(`SHA256 mismatch for authlib-injector: expected ${version.sha256}, got ${actual}`)
      }
    }

    fs.writeFileSync(jarPath, buffer)
    return jarPath
  }
}
