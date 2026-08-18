import { shell, net } from 'electron'
import http from 'http'
import { randomUUID } from 'crypto'

const FLEXO_WEB_APP = 'https://acc.flexo.lol'
const AUTH_SERVER = 'https://auth.flexo.lol/authlib-injector'
const AUTHORITY_DISCORD = 'x://discord'

export interface DiscordSession {
  accessToken: string
  clientToken: string
  playerName: string
  playerUuid: string
  userType: string
  properties: any[]
  authServer: string
  refreshToken: string
}

export class DiscordAuthService {
  private pendingResolve: ((ticket: string) => void) | null = null
  private pendingReject: ((error: Error) => void) | null = null
  private server: http.Server | null = null
  private port: number = 0

  async login(): Promise<DiscordSession> {
    const clientToken = randomUUID()
    const redirectUrl = `http://127.0.0.1:${await this.ensureServer()}/auth`
    const authUrl = `${FLEXO_WEB_APP}/launcher/auth?clientToken=${clientToken}&redirectUrl=${encodeURIComponent(redirectUrl)}`

    shell.openExternal(authUrl)

    const ticket = await this.waitForTicket()
    return this.exchangeTicket(ticket, clientToken)
  }

  async refresh(clientToken: string, refreshToken: string): Promise<DiscordSession> {
    const response = await fetch(`${FLEXO_WEB_APP}/api/launcher/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientToken, refreshToken }),
    })

    if (!response.ok) {
      throw new Error(`Refresh failed: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      accessToken: data.accessToken,
      clientToken: data.clientToken,
      playerName: data.playerName,
      playerUuid: data.playerUuid,
      userType: data.userType || 'mojang',
      properties: data.properties || [],
      authServer: data.authServer || AUTH_SERVER,
      refreshToken: data.refreshToken,
    }
  }

  resolveTicket(ticket: string) {
    if (this.pendingResolve) {
      this.pendingResolve(ticket)
      this.pendingResolve = null
      this.pendingReject = null
    }
  }

  private async exchangeTicket(ticket: string, clientToken: string): Promise<DiscordSession> {
    const response = await fetch(`${FLEXO_WEB_APP}/api/launcher/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, clientToken }),
    })

    if (!response.ok) {
      throw new Error(`Ticket exchange failed: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      accessToken: data.accessToken,
      clientToken: data.clientToken,
      playerName: data.playerName,
      playerUuid: data.playerUuid,
      userType: data.userType || 'mojang',
      properties: data.properties || [],
      authServer: data.authServer || AUTH_SERVER,
      refreshToken: data.refreshToken,
    }
  }

  private waitForTicket(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve
      this.pendingReject = reject
      setTimeout(() => {
        if (this.pendingReject) {
          this.pendingReject(new Error('Login timed out'))
          this.pendingResolve = null
          this.pendingReject = null
        }
      }, 5 * 60 * 1000)
    })
  }

  private ensureServer(): Promise<number> {
    if (this.server) return Promise.resolve(this.port)

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url!, `http://127.0.0.1`)
        if (url.pathname === '/auth') {
          const ticket = url.searchParams.get('ticket')
          if (ticket) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end('<html><body><script>window.close()</script><p>You can close this window.</p></body></html>')
            this.resolveTicket(ticket)
          } else {
            res.writeHead(400)
            res.end('Missing ticket')
          }
        } else {
          res.writeHead(404)
          res.end('Not found')
        }
      })

      this.server.listen(0, '127.0.0.1', () => {
        this.port = (this.server!.address() as any).port
        resolve(this.port)
      })

      this.server.on('error', reject)
    })
  }
}
