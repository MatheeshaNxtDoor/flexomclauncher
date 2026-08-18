import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'

export interface GameInstance {
  id: string
  name: string
  version: string
  modLoader: 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt'
  modLoaderVersion?: string
  gameDirectory: string
  javaPath?: string
  maxMemory?: number
  minMemory?: number
  jvmArgs?: string[]
  lastPlayed: number
  createdAt: number
  iconColor: string
  mods: ModInfo[]
}

export interface ModInfo {
  id: string
  name: string
  version: string
  source: 'modrinth' | 'curseforge'
  filename: string
}

interface InstanceData {
  instances: GameInstance[]
}

const INSTANCE_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#06b6d4',
]

export class InstanceStore {
  private filePath: string
  private data: InstanceData

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'instances.json')
    this.data = this.load()
  }

  private load(): InstanceData {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
      }
    } catch (e) {
      console.error('Failed to load instances:', e)
    }
    return { instances: [] }
  }

  private save() {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
  }

  getAllInstances(): GameInstance[] {
    return this.data.instances.sort((a, b) => b.lastPlayed - a.lastPlayed)
  }

  getInstance(id: string): GameInstance | undefined {
    return this.data.instances.find((i) => i.id === id)
  }

  createInstance(config: {
    name: string
    version: string
    modLoader?: string
    modLoaderVersion?: string
    gameDirectory?: string
  }): GameInstance {
    const instance: GameInstance = {
      id: randomUUID(),
      name: config.name,
      version: config.version,
      modLoader: (config.modLoader as any) || 'vanilla',
      modLoaderVersion: config.modLoaderVersion,
      gameDirectory: config.gameDirectory || path.join(
        app.getPath('userData'),
        'instances',
        config.name.toLowerCase().replace(/\s+/g, '-')
      ),
      lastPlayed: 0,
      createdAt: Date.now(),
      iconColor: INSTANCE_COLORS[this.data.instances.length % INSTANCE_COLORS.length],
      mods: [],
    }

    this.data.instances.push(instance)
    this.save()
    return instance
  }

  deleteInstance(id: string) {
    this.data.instances = this.data.instances.filter((i) => i.id !== id)
    this.save()
  }

  setLastPlayed(id: string) {
    const instance = this.data.instances.find((i) => i.id === id)
    if (instance) {
      instance.lastPlayed = Date.now()
      this.save()
    }
  }

  addMod(instanceId: string, mod: ModInfo) {
    const instance = this.data.instances.find((i) => i.id === instanceId)
    if (instance) {
      instance.mods.push(mod)
      this.save()
    }
  }

  removeMod(instanceId: string, modId: string) {
    const instance = this.data.instances.find((i) => i.id === instanceId)
    if (instance) {
      instance.mods = instance.mods.filter((m) => m.id !== modId)
      this.save()
    }
  }
}
