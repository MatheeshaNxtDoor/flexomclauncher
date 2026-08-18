import { ChildProcess, spawn, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'

export interface LaunchResult {
  pid: number
}

export class LauncherService {
  private javaPath: string | null = null
  private runningProcesses: Map<string, ChildProcess> = new Map()

  setRunning(instanceId: string, proc: ChildProcess) {
    this.runningProcesses.set(instanceId, proc)
    proc.on('exit', () => this.runningProcesses.delete(instanceId))
    proc.on('error', () => this.runningProcesses.delete(instanceId))
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
}
