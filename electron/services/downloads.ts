import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import { createWriteStream } from 'fs'

export interface DownloadTask {
  id: string
  url: string
  destPath: string
  filename: string
  sha1?: string
  size?: number
  type: 'library' | 'asset' | 'mod' | 'client' | 'authlib' | 'other'
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled'
  progress: number
  error?: string
}

export interface DownloadJob {
  id: string
  label: string
  tasks: DownloadTask[]
  completedTasks: number
  totalTasks: number
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled'
  speed: number
  startedAt?: number
}

export class DownloadManager extends EventEmitter {
  private jobs: Map<string, DownloadJob> = new Map()
  private activeJobs: string[] = []
  private maxConcurrentJobs = 1
  private maxConcurrentDownloads = 8

  createJob(id: string, label: string, tasks: { url: string; destPath: string; filename: string; sha1?: string; size?: number; type: DownloadTask['type'] }[]): DownloadJob {
    const job: DownloadJob = {
      id,
      label,
      tasks: tasks.map((t, i) => ({
        id: `${id}-${i}`,
        ...t,
        status: 'pending' as const,
        progress: 0,
      })),
      completedTasks: 0,
      totalTasks: tasks.length,
      status: 'pending',
      speed: 0,
    }
    this.jobs.set(id, job)
    return job
  }

  async startJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) throw new Error(`Job ${jobId} not found`)

    if (this.activeJobs.length >= this.maxConcurrentJobs) {
      return new Promise((resolve) => {
        const check = () => {
          if (this.activeJobs.length < this.maxConcurrentJobs) {
            this.startJobInternal(jobId).then(resolve)
          } else {
            setTimeout(check, 1000)
          }
        }
        check()
      })
    }

    await this.startJobInternal(jobId)
  }

  private async startJobInternal(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) return

    job.status = 'downloading'
    job.startedAt = Date.now()
    this.activeJobs.push(jobId)
    this.emit('job-started', jobId)

    const pendingTasks = job.tasks.filter(t => t.status === 'pending')
    const queue = [...pendingTasks]
    let completed = 0

    const worker = async () => {
      while (queue.length > 0) {
        const task = queue.shift()!
        if (task.status === 'cancelled') continue

        task.status = 'downloading'
        this.emit('task-started', { jobId, taskId: task.id })

        try {
          const dir = path.dirname(task.destPath)
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

          if (!fs.existsSync(task.destPath)) {
            await this.downloadFile(task.url, task.destPath, task.sha1, (progress) => {
              task.progress = progress
              this.emit('task-progress', { jobId, taskId: task.id, progress })
            })
          }

          task.status = 'completed'
          task.progress = 100
          completed++
          job.completedTasks = completed
          this.emit('task-completed', { jobId, taskId: task.id })

          if (job.completedTasks % 10 === 0 || job.completedTasks === job.totalTasks) {
            this.emit('job-progress', {
              jobId,
              completed: job.completedTasks,
              total: job.totalTasks,
              percent: Math.round((job.completedTasks / job.totalTasks) * 100),
            })
          }
        } catch (err: any) {
          task.status = 'failed'
          task.error = err.message
          completed++
          job.completedTasks = completed
          this.emit('task-failed', { jobId, taskId: task.id, error: err.message })
        }
      }
    }

    const workers = Array(Math.min(this.maxConcurrentDownloads, queue.length)).fill(null).map(() => worker())
    await Promise.all(workers)

    const failedTasks = job.tasks.filter(t => t.status === 'failed')
    job.status = failedTasks.length > 0 ? 'failed' : 'completed'
    this.activeJobs = this.activeJobs.filter(id => id !== jobId)

    this.emit('job-completed', { jobId, status: job.status, failedCount: failedTasks.length })
  }

  cancelJob(jobId: string): void {
    const job = this.jobs.get(jobId)
    if (!job) return

    for (const task of job.tasks) {
      if (task.status === 'pending' || task.status === 'downloading') {
        task.status = 'cancelled'
      }
    }
    job.status = 'cancelled'
    this.emit('job-cancelled', jobId)
  }

  getJob(jobId: string): DownloadJob | undefined {
    return this.jobs.get(jobId)
  }

  getAllJobs(): DownloadJob[] {
    return Array.from(this.jobs.values())
  }

  private async downloadFile(url: string, destPath: string, expectedSha1?: string, onProgress?: (progress: number) => void): Promise<void> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Download failed: ${url} (${res.status})`)

    const contentLength = Number(res.headers.get('content-length') || 0)
    const fileStream = createWriteStream(destPath)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const crypto = await import('crypto')
    const hash = crypto.createHash('sha1')
    let downloaded = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      fileStream.write(value)
      hash.update(value)
      downloaded += value.length

      if (contentLength > 0) {
        onProgress?.(Math.round((downloaded / contentLength) * 100))
      }
    }
    fileStream.end()

    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve)
      fileStream.on('error', reject)
    })

    if (expectedSha1) {
      const actual = hash.digest('hex')
      if (actual !== expectedSha1) {
        fs.unlinkSync(destPath)
        throw new Error(`SHA1 mismatch: expected ${expectedSha1}, got ${actual}`)
      }
    }
  }
}
