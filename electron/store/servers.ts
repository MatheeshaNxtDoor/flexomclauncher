import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export interface ServerEntry {
  id: string
  name: string
  address: string
  instanceId?: string
  lastPlayed: number
  createdAt: number
  order: number
}

interface ServerData {
  servers: ServerEntry[]
}

export class ServerStore {
  private filePath: string
  private data: ServerData

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'servers.json')
    this.data = this.load()
  }

  private load(): ServerData {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
      }
    } catch (e) {
      console.error('Failed to load servers:', e)
    }
    return { servers: [] }
  }

  private save() {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
  }

  getAll(): ServerEntry[] {
    return [...this.data.servers].sort((a, b) => a.order - b.order)
  }

  getById(id: string): ServerEntry | undefined {
    return this.data.servers.find(s => s.id === id)
  }

  add(config: { name: string; address: string; instanceId?: string }): ServerEntry {
    const server: ServerEntry = {
      id: randomUUID(),
      name: config.name,
      address: config.address,
      instanceId: config.instanceId,
      lastPlayed: 0,
      createdAt: Date.now(),
      order: this.data.servers.length,
    }
    this.data.servers.push(server)
    this.save()
    return server
  }

  update(id: string, updates: Partial<Pick<ServerEntry, 'name' | 'address' | 'instanceId'>>) {
    const server = this.data.servers.find(s => s.id === id)
    if (server) {
      if (updates.name !== undefined) server.name = updates.name
      if (updates.address !== undefined) server.address = updates.address
      if (updates.instanceId !== undefined) server.instanceId = updates.instanceId
      this.save()
    }
  }

  remove(id: string) {
    this.data.servers = this.data.servers.filter(s => s.id !== id)
    this.save()
  }

  setLastPlayed(id: string) {
    const server = this.data.servers.find(s => s.id === id)
    if (server) {
      server.lastPlayed = Date.now()
      this.save()
    }
  }

  reorder(orderedIds: string[]) {
    orderedIds.forEach((id, index) => {
      const server = this.data.servers.find(s => s.id === id)
      if (server) server.order = index
    })
    this.save()
  }
}
