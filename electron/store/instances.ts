import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'

export interface GameInstance {
  id: string
  name: string
  version: string
  versionId?: string
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
  type: 'mod' | 'shader' | 'resourcepack' | 'datapack'
  disabled?: boolean
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

  updateInstance(id: string, updates: Partial<GameInstance>) {
    const instance = this.data.instances.find((i) => i.id === id)
    if (instance) {
      Object.assign(instance, updates)
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

  toggleMod(instanceId: string, modId: string) {
    const instance = this.data.instances.find((i) => i.id === instanceId)
    if (instance) {
      const mod = instance.mods.find((m) => m.id === modId)
      if (mod) {
        mod.disabled = !mod.disabled
        this.save()
      }
    }
  }

  listContentFiles(instanceId: string, contentType: string): Array<{ filename: string; disabled: boolean }> {
    const instance = this.data.instances.find((i) => i.id === instanceId)
    if (!instance) return []

    const dirMap: Record<string, string> = {
      mod: 'mods',
      shader: 'shaderpacks',
      resourcepack: 'resourcepacks',
      datapack: 'datapacks',
    }
    const dirName = dirMap[contentType] || 'mods'
    const contentDir = path.join(instance.gameDirectory, dirName)

    if (!fs.existsSync(contentDir)) return []

    const files = fs.readdirSync(contentDir).filter(f => {
      if (contentType === 'mod') return f.endsWith('.jar')
      if (contentType === 'shader') return f.endsWith('.zip') || f.endsWith('.jar')
      if (contentType === 'resourcepack') return f.endsWith('.zip')
      return true
    })

    return files.map(f => ({
      filename: f,
      disabled: f.endsWith('.disabled'),
    }))
  }

  deleteModFile(instanceId: string, contentType: string, filename: string): boolean {
    const instance = this.data.instances.find((i) => i.id === instanceId)
    if (!instance) return false

    const dirMap: Record<string, string> = {
      mod: 'mods',
      shader: 'shaderpacks',
      resourcepack: 'resourcepacks',
      datapack: 'datapacks',
    }
    const dirName = dirMap[contentType] || 'mods'
    const filePath = path.join(instance.gameDirectory, dirName, filename)

    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true })
      return true
    }
    return false
  }

  toggleModFile(instanceId: string, contentType: string, filename: string): string | null {
    const instance = this.data.instances.find((i) => i.id === instanceId)
    if (!instance) return null

    const dirMap: Record<string, string> = {
      mod: 'mods',
      shader: 'shaderpacks',
      resourcepack: 'resourcepacks',
      datapack: 'datapacks',
    }
    const dirName = dirMap[contentType] || 'mods'
    const contentDir = path.join(instance.gameDirectory, dirName)

    if (!fs.existsSync(contentDir)) return null

    const oldPath = path.join(contentDir, filename)
    if (!fs.existsSync(oldPath)) return null

    let newName: string
    if (filename.endsWith('.disabled')) {
      newName = filename.slice(0, -9)
    } else {
      newName = filename + '.disabled'
    }

    const newPath = path.join(contentDir, newName)
    fs.renameSync(oldPath, newPath)
    return newName
  }
}
