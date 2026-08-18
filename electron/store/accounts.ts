import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface Account {
  id: string
  type: 'discord' | 'microsoft'
  playerName: string
  playerUuid: string
  accessToken: string
  clientToken: string
  refreshToken: string
  authServer: string
  userType: string
  properties: any[]
  lastPlayed: number
}

interface AccountData {
  accounts: Account[]
  currentAccountId: string | null
}

export class AccountStore {
  private filePath: string
  private data: AccountData

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'accounts.json')
    this.data = this.load()
  }

  private load(): AccountData {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
      }
    } catch (e) {
      console.error('Failed to load accounts:', e)
    }
    return { accounts: [], currentAccountId: null }
  }

  private save() {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
  }

  getAllAccounts(): Account[] {
    return this.data.accounts
  }

  getAccount(id: string): Account | undefined {
    return this.data.accounts.find((a) => a.id === id)
  }

  getCurrentAccount(): Account | null {
    if (!this.data.currentAccountId) return null
    return this.data.accounts.find((a) => a.id === this.data.currentAccountId) ?? null
  }

  setCurrentAccount(id: string) {
    this.data.currentAccountId = id
    this.save()
  }

  addAccount(account: Account) {
    const existing = this.data.accounts.findIndex((a) => a.id === account.id)
    if (existing >= 0) {
      this.data.accounts[existing] = account
    } else {
      this.data.accounts.push(account)
    }
    if (!this.data.currentAccountId) {
      this.data.currentAccountId = account.id
    }
    this.save()
  }

  updateAccount(id: string, updates: Partial<Account>) {
    const account = this.data.accounts.find((a) => a.id === id)
    if (account) {
      Object.assign(account, updates)
      this.save()
    }
  }

  removeAccount(id: string) {
    this.data.accounts = this.data.accounts.filter((a) => a.id !== id)
    if (this.data.currentAccountId === id) {
      this.data.currentAccountId = this.data.accounts[0]?.id ?? null
    }
    this.save()
  }
}
