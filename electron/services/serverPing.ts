import net from 'net'
import { randomUUID } from 'crypto'

export interface ServerPingResult {
  online: boolean
  motd: string
  motdClean: string
  version: string
  players: { online: number; max: number }
  icon: string | null
  latency: number
}

function writeVarInt(value: number): Buffer {
  const parts: number[] = []
  let v = value
  do {
    let byte = v & 0x7f
    v >>>= 7
    if (v !== 0) byte |= 0x80
    parts.push(byte)
  } while (v !== 0)
  return Buffer.from(parts)
}

function readVarInt(buf: Buffer, offset: number): { value: number; newOffset: number } {
  let result = 0
  let shift = 0
  let pos = offset
  while (pos < buf.length) {
    const byte = buf[pos++]
    result |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) break
    shift += 7
  }
  return { value: result, newOffset: pos }
}

function buildPacket(id: number, data: Buffer): Buffer {
  const idBuf = writeVarInt(id)
  const lengthBuf = writeVarInt(idBuf.length + data.length)
  return Buffer.concat([lengthBuf, idBuf, data])
}

function buildHandshake(host: string, port: number): Buffer {
  const protocolBuf = writeVarInt(769)
  const hostBuf = Buffer.concat([writeVarInt(host.length), Buffer.from(host, 'utf-8')])
  const portBuf = Buffer.alloc(2)
  portBuf.writeUInt16BE(port)
  const stateBuf = writeVarInt(1)
  const data = Buffer.concat([protocolBuf, hostBuf, portBuf, stateBuf])
  return buildPacket(0x00, data)
}

function buildStatusRequest(): Buffer {
  return buildPacket(0x00, Buffer.alloc(0))
}

function parseJsonText(text: any): string {
  if (typeof text === 'string') return text
  if (text?.text) return text.text
  if (text?.extra) return text.extra.map((e: any) => parseJsonText(e)).join('')
  if (text?.translate) return text.translate
  return ''
}

function cleanMotd(motd: string): string {
  return motd
    .replace(/§[0-9a-fk-or]/g, '')
    .replace(/\u00a7[0-9a-fk-or]/g, '')
    .trim()
}

export function pingServer(host: string, port: number = 25565, timeout: number = 5000): Promise<ServerPingResult> {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const socket = new net.Socket()
    let responseData = Buffer.alloc(0)
    let handshakeSent = false

    const cleanup = () => {
      try { socket.destroy() } catch {}
    }

    const timeoutId = setTimeout(() => {
      cleanup()
      resolve({
        online: false,
        motd: '',
        motdClean: '',
        version: '',
        players: { online: 0, max: 0 },
        icon: null,
        latency: Date.now() - startTime,
      })
    }, timeout)

    socket.on('connect', () => {
      socket.write(buildHandshake(host, port))
      socket.write(buildStatusRequest())
      handshakeSent = true
    })

    socket.on('data', (chunk) => {
      responseData = Buffer.concat([responseData, chunk])

      try {
        let offset = 0
        const { value: packetLength, newOffset: lenEnd } = readVarInt(responseData, offset)
        if (responseData.length < lenEnd + packetLength) return

        offset = lenEnd
        const { value: packetId, newOffset: idEnd } = readVarInt(responseData, offset)
        offset = idEnd

        if (packetId === 0x00) {
          const { value: jsonLen, newOffset: jsonLenEnd } = readVarInt(responseData, offset)
          offset = jsonLenEnd
          const jsonStr = responseData.toString('utf-8', offset, offset + jsonLen)
          const json = JSON.parse(jsonStr)

          let icon: string | null = null
          if (json.favicon) {
            const base64 = json.favicon.replace('data:image/png;base64,', '')
            icon = `data:image/png;base64,${base64}`
          }

          const motd = json.description ? JSON.stringify(json.description) : ''
          const motdClean = cleanMotd(parseJsonText(json.description))

          clearTimeout(timeoutId)
          cleanup()
          resolve({
            online: true,
            motd,
            motdClean,
            version: json.version?.name || '',
            players: {
              online: json.players?.online || 0,
              max: json.players?.max || 0,
            },
            icon,
            latency: Date.now() - startTime,
          })
        }
      } catch {}
    })

    socket.on('error', () => {
      clearTimeout(timeoutId)
      cleanup()
      resolve({
        online: false,
        motd: '',
        motdClean: '',
        version: '',
        players: { online: 0, max: 0 },
        icon: null,
        latency: Date.now() - startTime,
      })
    })

    socket.on('close', () => {
      clearTimeout(timeoutId)
    })

    socket.connect(port, host)
  })
}

export function parseServerAddress(address: string): { host: string; port: number } {
  const trimmed = address.trim()
  const parts = trimmed.split(':')
  if (parts.length === 2) {
    return { host: parts[0], port: parseInt(parts[1], 10) || 25565 }
  }
  return { host: trimmed, port: 25565 }
}
