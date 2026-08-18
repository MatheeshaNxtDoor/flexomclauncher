import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

export class ModLoaderService {
  private cacheDir: string

  constructor(userDataPath: string) {
    this.cacheDir = path.join(userDataPath, 'modloaders')
    if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true })
  }

  async installLoader(
    modLoader: string,
    gameVersion: string,
    gameDir: string,
    onProgress?: (msg: string) => void
  ): Promise<void> {
    switch (modLoader) {
      case 'fabric':
        await this.installFabric(gameVersion, gameDir, onProgress)
        break
      case 'forge':
        await this.installForge(gameVersion, gameDir, onProgress)
        break
      case 'neoforge':
        await this.installNeoForge(gameVersion, gameDir, onProgress)
        break
      case 'quilt':
        await this.installQuilt(gameVersion, gameDir, onProgress)
        break
      case 'vanilla':
      default:
        break
    }
  }

  private async installFabric(gameVersion: string, gameDir: string, onProgress?: (msg: string) => void) {
    onProgress?.('Fetching Fabric loader metadata...')

    const loaderData = await this.fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`)
    if (!loaderData || !loaderData.length) throw new Error(`No Fabric loader available for ${gameVersion}`)

    const loader = loaderData[0]
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
    const versionsDir = path.join(gameDir, 'versions')
    const versionId = `${gameVersion}-fabric-${loaderVersion}`
    const versionDir = path.join(versionsDir, versionId)
    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })

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
          '-Dfabric.remapClasspathFile=${fabric_classpath}',
        ],
      },
      libraries: [
        {
          name: `net.fabricmc:intermediary:${intermediaryVersion}:v2`,
          url: 'https://maven.fabricmc.net/',
        },
        {
          name: `net.fabricmc:fabric-loader:${loaderVersion}`,
          url: 'https://maven.fabricmc.net/',
        },
        {
          name: `net.fabricmc:sponge-mixin:0.15.11+mixin.0.8.5`,
          url: 'https://maven.fabricmc.net/',
        },
      ],
    }

    fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(versionJson, null, 2))
    onProgress?.(`Fabric ${loaderVersion} installed for ${gameVersion}`)
  }

  private async installForge(gameVersion: string, gameDir: string, onProgress?: (msg: string) => void) {
    onProgress?.('Fetching Forge version metadata...')

    const promos = await this.fetchJson('https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json')
    if (!promos || !promos.promos) throw new Error('Failed to fetch Forge versions')

    const latestKey = Object.keys(promos.promos).find(k => k.startsWith(`${gameVersion}-`) && k.endsWith('-latest'))
    if (!latestKey) throw new Error(`No Forge version available for ${gameVersion}`)

    const forgeVersion = promos.promos[latestKey]
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
      throw new Error(`Forge installer failed: ${err.message}`)
    }

    onProgress?.(`Forge ${forgeVersion} installed for ${gameVersion}`)
  }

  private async installNeoForge(gameVersion: string, gameDir: string, onProgress?: (msg: string) => void) {
    onProgress?.('Fetching NeoForge version metadata...')

    const data = await this.fetchJson('https://projects.neoforged.net/api/v1/projects/neoforged/neoforge')
    if (!data) throw new Error('Failed to fetch NeoForge versions')

    const versions = data.gameVersions?.[gameVersion]
    if (!versions || !versions.length) throw new Error(`No NeoForge version available for ${gameVersion}`)

    const latest = versions[0]
    const neoforgeVersion = latest.version
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
      throw new Error(`NeoForge installer failed: ${err.message}`)
    }

    onProgress?.(`NeoForge ${neoforgeVersion} installed for ${gameVersion}`)
  }

  private async installQuilt(gameVersion: string, gameDir: string, onProgress?: (msg: string) => void) {
    onProgress?.('Fetching Quilt loader metadata...')

    const loaderData = await this.fetchJson(`https://meta.quiltmc.org/v3/versions/loader/${gameVersion}`)
    if (!loaderData || !loaderData.length) throw new Error(`No Quilt loader available for ${gameVersion}`)

    const loader = loaderData[0]
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
    const versionsDir = path.join(gameDir, 'versions')
    const versionId = `${gameVersion}-quilt-${loaderVersion}`
    const versionDir = path.join(versionsDir, versionId)
    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })

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
      ],
    }

    fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(versionJson, null, 2))
    onProgress?.(`Quilt ${loaderVersion} installed for ${gameVersion}`)
  }

  getVersionId(modLoader: string, gameVersion: string, loaderVersion?: string): string {
    if (modLoader === 'vanilla') return gameVersion
    if (modLoader === 'fabric' || modLoader === 'quilt') {
      return `${gameVersion}-${modLoader}-${loaderVersion || 'latest'}`
    }
    return gameVersion
  }

  private async findJava(): Promise<string | null> {
    const { execSync } = await import('child_process')
    const tryCommands = ['javaw', 'java']
    for (const cmd of tryCommands) {
      try {
        const result = execSync(`"${cmd}" -version`, { stdio: 'pipe', timeout: 5000 })
        const output = result.toString()
        return cmd
      } catch {}
    }
    const paths = [
      'C:\\Program Files\\Java',
      'C:\\Program Files (x86)\\Java',
      `${process.env.USERPROFILE}\\.jdks`,
    ]
    for (const p of paths) {
      if (fs.existsSync(p)) {
        const entries = fs.readdirSync(p)
        for (const e of entries) {
          const javaw = path.join(p, e, 'bin', 'javaw.exe')
          if (fs.existsSync(javaw)) return javaw
        }
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
