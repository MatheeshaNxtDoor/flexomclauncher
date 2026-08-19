import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import crypto from 'crypto'

export type ModLoaderType = 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt'

export interface LoaderInstallResult {
  loaderVersion: string
  versionId: string
}

export class ModLoaderService {
  private cacheDir: string

  constructor(userDataPath: string) {
    this.cacheDir = path.join(userDataPath, 'modloaders')
    if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true })
  }

  async installLoader(
    modLoader: ModLoaderType,
    gameVersion: string,
    gameDir: string,
    onProgress?: (msg: string) => void,
    loaderVersionOverride?: string
  ): Promise<LoaderInstallResult> {
    switch (modLoader) {
      case 'fabric':
        return this.installFabric(gameVersion, gameDir, onProgress, loaderVersionOverride)
      case 'forge':
        return this.installForge(gameVersion, gameDir, onProgress, loaderVersionOverride)
      case 'neoforge':
        return this.installNeoForge(gameVersion, gameDir, onProgress, loaderVersionOverride)
      case 'quilt':
        return this.installQuilt(gameVersion, gameDir, onProgress, loaderVersionOverride)
      case 'vanilla':
      default:
        return { loaderVersion: '', versionId: gameVersion }
    }
  }

  async getAvailableVersions(modLoader: ModLoaderType, gameVersion: string): Promise<string[]> {
    try {
      switch (modLoader) {
        case 'fabric': {
          const data = await this.fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`)
          if (!data || !data.length) return []
          return data.map((l: any) => l.loader.version)
        }
        case 'forge': {
          const promos = await this.fetchJson('https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json')
          if (!promos?.promos) return []
          return Object.keys(promos.promos)
            .filter(k => k.startsWith(`${gameVersion}-`) && k.endsWith('-latest'))
            .map(k => promos.promos[k])
        }
        case 'neoforge': {
          const data = await this.fetchJson('https://projects.neoforged.net/api/v1/projects/neoforged/neoforge')
          if (!data?.gameVersions?.[gameVersion]) return []
          return data.gameVersions[gameVersion].map((v: any) => v.version)
        }
        case 'quilt': {
          const data = await this.fetchJson(`https://meta.quiltmc.org/v3/versions/loader/${gameVersion}`)
          if (!data || !data.length) return []
          return data.map((l: any) => l.loader.version)
        }
        default:
          return []
      }
    } catch (e) {
      console.warn(`Failed to get available versions for ${modLoader}:`, e)
      return []
    }
  }

  private async installFabric(
    gameVersion: string, gameDir: string,
    onProgress?: (msg: string) => void, versionOverride?: string
  ): Promise<LoaderInstallResult> {
    onProgress?.('Fetching Fabric loader metadata...')

    const loaderData = await this.fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`)
    if (!loaderData?.length) throw new Error(`No Fabric loader available for ${gameVersion}`)

    const loader = versionOverride
      ? loaderData.find((l: any) => l.loader.version === versionOverride) || loaderData[0]
      : loaderData[0]

    const loaderVersion = loader.loader.version
    const intermediaryVersion = loader.intermediary.version

    onProgress?.(`Downloading Fabric loader ${loaderVersion}...`)

    const loaderJar = path.join(this.cacheDir, `fabric-loader-${loaderVersion}.jar`)
    if (!fs.existsSync(loaderJar)) {
      await this.downloadFile(
        `https://maven.fabricmc.net/net/fabricmc/fabric-loader/${loaderVersion}/fabric-loader-${loaderVersion}.jar`,
        loaderJar
      )
    }

    onProgress?.('Downloading Fabric intermediary...')
    const intermediaryJar = path.join(this.cacheDir, `fabric-intermediary-${intermediaryVersion}.jar`)
    if (!fs.existsSync(intermediaryJar)) {
      await this.downloadFile(
        `https://maven.fabricmc.net/net/fabricmc/intermediary/${intermediaryVersion}/intermediary-${intermediaryVersion}.jar`,
        intermediaryJar
      )
    }

    onProgress?.('Creating Fabric version profile...')
    const versionId = `${gameVersion}-fabric-${loaderVersion}`

    const versionJson = {
      id: versionId,
      inheritsFrom: gameVersion,
      type: 'release',
      mainClass: 'net.fabricmc.loader.impl.launch.knot.KnotClient',
      arguments: {
        game: [
          '--assetIndex', '${assets_index_name}',
          '--assetsDir', '${assets_root}',
          '--uuid', '${auth_uuid}',
          '--username', '${auth_player_name}',
          '--accessToken', '${auth_access_token}',
          '--userType', '${auth_user_type}',
          '--versionType', 'Fabric',
        ],
        jvm: [
          { rules: [{ features: { is_demo_user: false } }], value: '-Dfabric.remapClasspathFile=${fabric_classpath}' },
        ],
      },
      libraries: [
        {
          name: `net.fabricmc:intermediary:${intermediaryVersion}:v2`,
          url: 'https://maven.fabricmc.net/',
          md5: undefined as string | undefined,
        },
        {
          name: `net.fabricmc:fabric-loader:${loaderVersion}`,
          url: 'https://maven.fabricmc.net/',
          md5: undefined as string | undefined,
        },
        {
          name: 'net.fabricmc:sponge-mixin:0.15.11+mixin.0.8.5',
          url: 'https://maven.fabricmc.net/',
          md5: undefined as string | undefined,
        },
        {
          name: `net.fabricmc:fabric-language-kotlin:1.12.3+kotlin2.0.21`,
          url: 'https://maven.fabricmc.net/',
          md5: undefined as string | undefined,
        },
      ],
    }

    const versionsDir = path.join(gameDir, 'versions')
    const versionDir = path.join(versionsDir, versionId)
    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })

    fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(versionJson, null, 2))
    onProgress?.(`Fabric ${loaderVersion} installed for ${gameVersion}`)

    return { loaderVersion, versionId }
  }

  private async installForge(
    gameVersion: string, gameDir: string,
    onProgress?: (msg: string) => void, versionOverride?: string
  ): Promise<LoaderInstallResult> {
    onProgress?.('Fetching Forge version metadata...')

    const promos = await this.fetchJson('https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json')
    if (!promos?.promos) throw new Error('Failed to fetch Forge versions')

    let forgeVersion: string
    if (versionOverride) {
      forgeVersion = versionOverride
    } else {
      const latestKey = Object.keys(promos.promos).find(k => k.startsWith(`${gameVersion}-`) && k.endsWith('-latest'))
      if (!latestKey) throw new Error(`No Forge version available for ${gameVersion}`)
      forgeVersion = promos.promos[latestKey]
    }

    onProgress?.(`Downloading Forge ${forgeVersion} installer...`)

    const installerJar = path.join(this.cacheDir, `forge-${gameVersion}-${forgeVersion}-installer.jar`)
    if (!fs.existsSync(installerJar)) {
      await this.downloadFile(
        `https://files.minecraftforge.net/maven/net/minecraftforge/forge/${gameVersion}-${forgeVersion}/forge-${gameVersion}-${forgeVersion}-installer.jar`,
        installerJar
      )
    }

    onProgress?.('Running Forge installer...')

    const { execSync } = await import('child_process')
    const javaPath = await this.findJava()
    if (!javaPath) throw new Error('Java not found. Forge installation requires Java.')

    try {
      execSync(`"${javaPath}" -jar "${installerJar}" --installClient "${gameDir}"`, {
        timeout: 300000,
        stdio: 'pipe',
      })
    } catch (err: any) {
      const stderr = err.stderr?.toString() || ''
      throw new Error(`Forge installer failed: ${err.message}${stderr ? '\n' + stderr : ''}`)
    }

    const versionId = `${gameVersion}-${forgeVersion}`
    onProgress?.(`Forge ${forgeVersion} installed for ${gameVersion}`)

    return { loaderVersion: forgeVersion, versionId }
  }

  private async installNeoForge(
    gameVersion: string, gameDir: string,
    onProgress?: (msg: string) => void, versionOverride?: string
  ): Promise<LoaderInstallResult> {
    onProgress?.('Fetching NeoForge version metadata...')

    const data = await this.fetchJson('https://projects.neoforged.net/api/v1/projects/neoforged/neoforge')
    if (!data) throw new Error('Failed to fetch NeoForge versions')

    const versions = data.gameVersions?.[gameVersion]
    if (!versions?.length) throw new Error(`No NeoForge version available for ${gameVersion}`)

    let neoforgeVersion: string
    if (versionOverride) {
      neoforgeVersion = versionOverride
    } else {
      neoforgeVersion = versions[0].version
    }

    onProgress?.(`Downloading NeoForge ${neoforgeVersion} installer...`)

    const installerJar = path.join(this.cacheDir, `neoforge-${neoforgeVersion}-installer.jar`)
    if (!fs.existsSync(installerJar)) {
      await this.downloadFile(
        `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoforgeVersion}/neoforge-${neoforgeVersion}-installer.jar`,
        installerJar
      )
    }

    onProgress?.('Running NeoForge installer...')

    const { execSync } = await import('child_process')
    const javaPath = await this.findJava()
    if (!javaPath) throw new Error('Java not found. NeoForge installation requires Java.')

    try {
      execSync(`"${javaPath}" -jar "${installerJar}" --installClient "${gameDir}"`, {
        timeout: 300000,
        stdio: 'pipe',
      })
    } catch (err: any) {
      const stderr = err.stderr?.toString() || ''
      throw new Error(`NeoForge installer failed: ${err.message}${stderr ? '\n' + stderr : ''}`)
    }

    const versionId = `${gameVersion}-${neoforgeVersion}`
    onProgress?.(`NeoForge ${neoforgeVersion} installed for ${gameVersion}`)

    return { loaderVersion: neoforgeVersion, versionId }
  }

  private async installQuilt(
    gameVersion: string, gameDir: string,
    onProgress?: (msg: string) => void, versionOverride?: string
  ): Promise<LoaderInstallResult> {
    onProgress?.('Fetching Quilt loader metadata...')

    const loaderData = await this.fetchJson(`https://meta.quiltmc.org/v3/versions/loader/${gameVersion}`)
    if (!loaderData?.length) throw new Error(`No Quilt loader available for ${gameVersion}`)

    const loader = versionOverride
      ? loaderData.find((l: any) => l.loader.version === versionOverride) || loaderData[0]
      : loaderData[0]

    const loaderVersion = loader.loader.version

    onProgress?.(`Downloading Quilt loader ${loaderVersion}...`)

    const loaderJar = path.join(this.cacheDir, `quilt-loader-${loaderVersion}.jar`)
    if (!fs.existsSync(loaderJar)) {
      await this.downloadFile(
        `https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-loader/${loaderVersion}/quilt-loader-${loaderVersion}.jar`,
        loaderJar
      )
    }

    onProgress?.('Creating Quilt version profile...')
    const versionId = `${gameVersion}-quilt-${loaderVersion}`

    const versionJson = {
      id: versionId,
      inheritsFrom: gameVersion,
      type: 'release',
      mainClass: 'org.quiltmc.loader.impl.launch.knot.KnotClient',
      arguments: {
        game: [
          '--assetIndex', '${assets_index_name}',
          '--assetsDir', '${assets_root}',
          '--uuid', '${auth_uuid}',
          '--username', '${auth_player_name}',
          '--accessToken', '${auth_access_token}',
          '--userType', '${auth_user_type}',
          '--versionType', 'Quilt',
        ],
      },
      libraries: [
        {
          name: `org.quiltmc:quilt-loader:${loaderVersion}`,
          url: 'https://maven.quiltmc.org/repository/release/',
        },
        {
          name: 'org.quiltmc:quilt-sponge-mixin:0.8.5+build.3',
          url: 'https://maven.quiltmc.org/repository/release/',
        },
      ],
    }

    const versionsDir = path.join(gameDir, 'versions')
    const versionDir = path.join(versionsDir, versionId)
    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })

    fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(versionJson, null, 2))
    onProgress?.(`Quilt ${loaderVersion} installed for ${gameVersion}`)

    return { loaderVersion, versionId }
  }

  getVersionId(modLoader: ModLoaderType, gameVersion: string, loaderVersion?: string): string {
    if (modLoader === 'vanilla') return gameVersion
    if (modLoader === 'fabric' || modLoader === 'quilt') {
      return `${gameVersion}-${modLoader}-${loaderVersion || 'latest'}`
    }
    if (modLoader === 'forge' || modLoader === 'neoforge') {
      return `${gameVersion}-${loaderVersion || 'latest'}`
    }
    return gameVersion
  }

  async findJava(): Promise<string | null> {
    const { execSync } = await import('child_process')

    for (const cmd of ['javaw', 'java']) {
      try {
        execSync(`"${cmd}" -version`, { stdio: 'pipe', timeout: 5000 })
        return cmd
      } catch {}
    }

    const paths = process.platform === 'win32'
      ? ['C:\\Program Files\\Java', 'C:\\Program Files (x86)\\Java', `${process.env.USERPROFILE}\\.jdks`]
      : ['/usr/lib/jvm', '/usr/java', `${process.env.HOME}/.jdks`]

    for (const p of paths) {
      if (!fs.existsSync(p)) continue
      const entries = fs.readdirSync(p)
      for (const e of entries) {
        const ext = process.platform === 'win32' ? 'javaw.exe' : 'java'
        const javaBin = path.join(p, e, 'bin', ext)
        if (fs.existsSync(javaBin)) return javaBin
      }
    }
    return null
  }

  private async fetchJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const get = url.startsWith('https') ? https.get : http.get
      get(url, (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch { reject(new Error(`Failed to parse JSON from ${url}`)) }
        })
      }).on('error', reject)
    })
  }

  private async downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const get = url.startsWith('https') ? https.get : http.get
      get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return this.downloadFile(res.headers.location!, dest).then(resolve, reject)
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} downloading ${url}`))
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const buffer = Buffer.concat(chunks)
          fs.writeFileSync(dest, buffer)
          resolve()
        })
        res.on('error', reject)
      }).on('error', reject)
    })
  }
}
