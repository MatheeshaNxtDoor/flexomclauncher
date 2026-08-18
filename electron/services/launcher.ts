import { ChildProcess, spawn, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'

const AUTHLIB_INJECTOR_URL = 'https://auth.flexo.lol/authlib-injector'

export interface LaunchResult {
  pid: number
}

export class LauncherService {
  private javaPath: string | null = null
  private runningProcesses: Map<string, ChildProcess> = new Map()
  private userDataPath: string

  constructor(userDataPath: string) {
    this.userDataPath = userDataPath
  }

  async launch(instance: any, account: any): Promise<LaunchResult> {
    const javaPath = account.type === 'discord'
      ? await this.findJava()
      : await this.findJava()

    if (!javaPath) {
      throw new Error('Java not found. Please install Java or set the path in Settings.')
    }

    const gameDir = instance.gameDirectory
    if (!fs.existsSync(gameDir)) {
      fs.mkdirSync(gameDir, { recursive: true })
    }

    const args: string[] = []

    if (account.type === 'discord') {
      const authlibPath = await this.getAuthLibInjector()
      args.push(
        `-javaagent:${authlibPath}=${AUTHLIB_INJECTOR_URL}`
      )
    }

    const memory = instance.maxMemory || 4096
    args.push(`-Xmx${memory}M`)
    if (instance.minMemory) {
      args.push(`-Xms${instance.minMemory}M`)
    }

    if (instance.jvmArgs) {
      args.push(...instance.jvmArgs)
    }

    args.push(
      '-Dminecraft.launcher.brand=Flexo',
      '-Dminecraft.launcher.version=1.0.0',
    )

    const classpath = await this.resolveClasspath(instance)
    args.push('-cp', classpath)

    args.push('net.minecraft.client.main.Minecraft')

    args.push('--username', account.playerName)
    args.push('--version', instance.version)
    args.push('--gameDir', gameDir)
    args.push('--assetsDir', path.join(gameDir, 'assets'))
    args.push('--assetIndex', await this.getAssetIndexId(instance.version))
    args.push('--uuid', account.playerUuid)
    args.push('--accessToken', account.accessToken)
    args.push('--userType', account.userType || 'mojang')
    args.push('--versionType', 'Flexo')

    if (account.properties && account.properties.length > 0) {
      args.push('--userProperties', JSON.stringify(account.properties))
    }

    const proc = spawn(javaPath, args, {
      cwd: gameDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    this.runningProcesses.set(instance.id, proc)

    proc.on('exit', () => {
      this.runningProcesses.delete(instance.id)
    })

    return { pid: proc.pid! }
  }

  kill(instanceId: string) {
    const proc = this.runningProcesses.get(instanceId)
    if (proc) {
      if (os.platform() === 'win32') {
        spawn('taskkill', ['/F', '/T', '/PID', String(proc.pid)])
      } else {
        proc.kill('SIGKILL')
      }
      this.runningProcesses.delete(instanceId)
    }
  }

  isRunning(instanceId: string): boolean {
    return this.runningProcesses.has(instanceId)
  }

  async findJava(): Promise<string | null> {
    if (this.javaPath && fs.existsSync(this.javaPath)) {
      return this.javaPath
    }

    const javaName = os.platform() === 'win32' ? 'javaw.exe' : 'java'
    const paths = [
      process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, 'bin', javaName),
      path.join(process.env.ProgramFiles || '', 'Java', 'jre*', 'bin', javaName),
      path.join(process.env.ProgramFiles || '', 'Java', 'jdk*', 'bin', javaName),
      path.join(os.homedir(), '.jdks', '*', 'bin', javaName),
    ].filter(Boolean) as string[]

    for (const p of paths) {
      if (p.includes('*')) {
        const dir = path.dirname(p)
        const parent = path.dirname(dir)
        if (fs.existsSync(parent)) {
          const entries = fs.readdirSync(parent)
          for (const entry of entries) {
            const full = path.join(parent, entry, 'bin', javaName)
            if (fs.existsSync(full)) {
              this.javaPath = full
              return full
            }
          }
        }
      } else if (fs.existsSync(p)) {
        this.javaPath = p
        return p
      }
    }

    try {
      const result = execSync(`which ${javaName}`, { encoding: 'utf-8' }).trim()
      if (result && fs.existsSync(result)) {
        this.javaPath = result
        return result
      }
    } catch {}

    return null
  }

  private async getAuthLibInjector(): Promise<string> {
    const cacheDir = path.join(this.userDataPath, 'authlib-injector')
    const jarPath = path.join(cacheDir, 'authlib-injector.jar')

    if (fs.existsSync(jarPath)) {
      return jarPath
    }

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
    }

    const response = await fetch('https://auth.flexo.lol/authlib-injector/download')
    const buffer = Buffer.from(await response.arrayBuffer())
    fs.writeFileSync(jarPath, buffer)
    return jarPath
  }

  private async resolveClasspath(instance: any): Promise<string> {
    const versionDir = path.join(instance.gameDirectory, 'versions', instance.version)
    const versionJsonPath = path.join(versionDir, `${instance.version}.json`)

    if (!fs.existsSync(versionJsonPath)) {
      throw new Error(`Version JSON not found for ${instance.version}`)
    }

    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'))
    const libraries: string[] = []

    const libsDir = path.join(instance.gameDirectory, 'libraries')
    for (const lib of versionJson.libraries || []) {
      const parts = lib.name.split(':')
      const libPath = path.join(
        libsDir,
        ...parts[0].split('.'),
        parts[1],
        parts[2],
        `${parts[1]}-${parts[2]}${lib.classifier ? `-${lib.classifier}` : ''}.jar`
      )
      if (fs.existsSync(libPath)) {
        libraries.push(libPath)
      }
    }

    const clientJar = path.join(versionDir, `${instance.version}.jar`)
    libraries.push(clientJar)

    const separator = os.platform() === 'win32' ? ';' : ':'
    return libraries.join(separator)
  }

  private async getAssetIndexId(version: string): Promise<string> {
    return version
  }
}
