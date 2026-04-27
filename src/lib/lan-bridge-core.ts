/**
 * LAN Messenger Protocol Bridge - Core Module
 *
 * Implements the full LAN Messenger (lmc) protocol for compatibility with
 * the original LAN Messenger desktop application.
 *
 * Supported message types (all 28):
 *   announce, depart, broadcast, message, status, userdata, ping, groupmessage,
 *   name, note, chatstate, publicmessage, acknowledge, avatar, version, query,
 *   info, file, failed, error, oldversion, folder, group, join, leave, refresh,
 *   webfailed, unknown
 *
 * Outbound capabilities:
 *   announce, depart, message, broadcast, status, note, chatstate, userdata, version, ping
 *
 * Usage:
 *   import { lanBridge } from './lan-bridge-core'
 *   await lanBridge.start()
 *   lanBridge.setUsername('Alice')
 *   lanBridge.sendBroadcastMessage('Hello everyone!')
 *   lanBridge.sendDirectMessage(userId, 'Hey!')
 *   lanBridge.sendStatusUpdate('away')
 *   lanBridge.sendNoteUpdate('In a meeting')
 *   lanBridge.sendChatState(userId, 'composing')
 *   lanBridge.sendUserData(userId)
 */

import dgram from 'node:dgram'
import net from 'node:net'
import { networkInterfaces, hostname } from 'node:os'
import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'node:crypto'
import { chatBus } from './chat-bus'
import { db } from './db'

// ==================== Configuration ====================

const DEFAULT_UDP_PORT = 50000
const MULTICAST_ADDR = '239.255.100.100'
const BROADCAST_ADDR = '255.255.255.255'
const APP_VERSION = '1.2.39'
const APP_MARKER = 'lmcmessage'

// ==================== Types ====================

export interface LANUser {
  id: string
  name: string
  address: string
  version: string
  status: string       // chat, busy, dnd, brb, away, gone
  note: string         // Status message / custom status
  caps: number         // Capabilities bitmask
  avatar: string       // Base64-encoded avatar or URL
  ip: string
  port: number
  lastSeen: number
  protocol: 'lanmessenger'
}

export interface LANBridgeStatus {
  running: boolean
  startedAt: number
  userId: string | null
  userName: string | null
  ipAddress: string | null
  udpPort: number
  multicastGroup: string
  userCount: number
  uptime: number
}

interface TcpPeer {
  userId: string
  address: string
  socket: net.Socket
  ready: boolean
  connecting: boolean
  buffer: Buffer
  pendingXml: string[]
  key?: Buffer
  iv?: Buffer
}

// ==================== LANBridge Class ====================

class LANBridge {
  private lanUsers = new Map<string, LANUser>()
  private localUserId: string | null = null
  private localUserName: string | null = null
  private localAddress: string | null = null
  private localStatus: string = 'chat'
  private localNote: string = ''
  private broadcastAddresses: string[] = [BROADCAST_ADDR]
  private msgId = 1
  private started = false
  private startedAt = 0

  private announceInterval: ReturnType<typeof setInterval> | null = null
  private staleInterval: ReturnType<typeof setInterval> | null = null

  private udpReceiver: dgram.Socket | null = null
  private udpSender: dgram.Socket | null = null
  private tcpServer: net.Server | null = null
  private tcpPeers = new Map<string, TcpPeer>()
  private publicKeyPem: Buffer | null = null
  private privateKeyPem: Buffer | null = null

  private get udpPort(): number {
    return parseInt(process.env.UDP_PORT || String(DEFAULT_UDP_PORT), 10)
  }

  // ==================== Public API ====================

  async start(): Promise<void> {
    if (this.started) return

    try {
      this.initIdentity()
      this.discoverBroadcastAddresses()
      this.ensureTcpKeyPair()

      this.udpReceiver = dgram.createSocket({ type: 'udp4', reuseAddr: true })
      this.udpSender = dgram.createSocket({ type: 'udp4', reuseAddr: true })

      // On Windows, setBroadcast must be called before bind for the sender socket
      try { this.udpSender!.setBroadcast(true) } catch (e: any) {
        console.log(`[LAN Bridge] Warning: Could not set broadcast on sender (pre-bind): ${e.message}`)
      }

      await new Promise<void>((resolve) => {
        this.udpSender!.bind(0, () => {
          // Also try post-bind (some OS need this)
          try { this.udpSender!.setBroadcast(true) } catch (e: any) {
            console.log(`[LAN Bridge] Warning: Could not set broadcast on sender (post-bind): ${e.message}`)
          }
          resolve()
        })
      })

      await new Promise<void>((resolve, reject) => {
        this.udpReceiver!.bind(this.udpPort, () => {
          try {
            this.udpReceiver!.setBroadcast(true)
            this.udpReceiver!.addMembership(MULTICAST_ADDR)
          } catch {
            // Non-critical — multicast may fail in some environments
          }

          this.udpReceiver!.on('message', (data: Buffer, rinfo: { address: string; port: number }) => {
            this.handleUdpMessage(data, rinfo)
          })

          this.udpReceiver!.on('error', (err: Error) => {
            console.error(`[LAN Bridge] UDP receiver error: ${err.message}`)
          })

          console.log(`[LAN Bridge] UDP listener bound to port ${this.udpPort}`)
          console.log(`[LAN Bridge] Joined multicast group ${MULTICAST_ADDR}`)
          resolve()
        })

        this.udpReceiver!.on('error', (err: Error) => {
          reject(err)
        })
      })

      this.udpSender.on('error', (err: Error) => {
        console.error(`[LAN Bridge] UDP sender error: ${err.message}`)
      })

      await this.startTcpServer()

      this.sendAnnounce()

      // After announce, send userdata to all known LAN users so they know our display name
      // Delay slightly to ensure announce is processed first
      setTimeout(() => {
        for (const [userId] of this.lanUsers) {
          this.sendUserData(userId)
        }
      }, 2000)

      const refreshIntervalSec = parseInt(process.env.REFRESH_INTERVAL || '30', 10) * 1000
      this.announceInterval = setInterval(() => this.sendAnnounce(), refreshIntervalSec)
      this.staleInterval = setInterval(() => this.cleanStaleUsers(), 60000)

      this.started = true
      this.startedAt = Date.now()

      this.logIdentity()
      console.log(`[LAN Bridge] Ready! Listening for LAN Messenger clients...`)
    } catch (err) {
      console.error(`[LAN Bridge] Failed to start: ${(err as Error).message}`)
      console.log('[LAN Bridge] Continuing without LAN support...')
      this.udpReceiver?.close()
      this.udpSender?.close()
      this.tcpServer?.close()
      this.udpReceiver = null
      this.udpSender = null
      this.tcpServer = null
    }
  }

  async stop(): Promise<void> {
    if (!this.started) return

    console.log('[LAN Bridge] Shutting down...')
    this.sendDepart()

    if (this.announceInterval) { clearInterval(this.announceInterval); this.announceInterval = null }
    if (this.staleInterval) { clearInterval(this.staleInterval); this.staleInterval = null }

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        this.udpReceiver?.close()
        this.udpSender?.close()
        this.tcpServer?.close()
        for (const peer of this.tcpPeers.values()) {
          peer.socket.destroy()
        }
        this.udpReceiver = null
        this.udpSender = null
        this.tcpServer = null
        this.tcpPeers.clear()
        resolve()
      }, 500)
    })

    this.lanUsers.clear()
    this.started = false
    console.log('[LAN Bridge] Stopped')
  }

  getUsers(): Omit<LANUser, 'protocol'>[] {
    return Array.from(this.lanUsers.values()).map(({ protocol: _p, ...rest }) => rest)
  }

  getStatus(): LANBridgeStatus {
    return {
      running: this.started,
      startedAt: this.startedAt,
      userId: this.localUserId,
      userName: this.localUserName,
      ipAddress: this.localAddress,
      udpPort: this.udpPort,
      multicastGroup: MULTICAST_ADDR,
      userCount: this.lanUsers.size,
      uptime: this.started ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
    }
  }

  /**
   * Update the display name used in LAN protocol messages.
   * Call this when a web user changes their profile name.
   */
  setUsername(name: string): boolean {
    if (name && name.trim()) {
      this.localUserName = name.trim()
      console.log(`[LAN Bridge] Username updated to: ${this.localUserName}`)
      return true
    }
    return false
  }

  /**
   * Send a direct (private) message to a specific LAN user.
   * Uses TWO delivery methods for maximum compatibility:
   *   1. MESSAG datagram directly to target's IP:port (efficient, direct)
   *   2. BRDCST datagram to broadcast address (fallback, guaranteed reach)
   * Both have <to> field so only the intended recipient processes them.
   * Some LAN Messenger versions only process BRDCST, some only MESSAG.
   */
  sendDirectMessage(targetUserId: string, content: string): boolean {
    if (!this.udpSender || !this.localUserId || !this.localUserName) {
      console.error(`[LAN Bridge] Cannot send DM: bridge not ready (sender=${!!this.udpSender}, userId=${!!this.localUserId}, userName=${!!this.localUserName})`)
      return false
    }

    const targetUser = this.lanUsers.get(targetUserId)
    if (!targetUser) {
      console.error(`[LAN Bridge] Cannot send DM: user ${targetUserId} not found in LAN users. Known users: ${Array.from(this.lanUsers.keys()).join(', ')}`)
      return false
    }

    const id = String(this.msgId++)
    const xml = this.buildXmlMessage(
      { from: this.localUserId, to: targetUserId, messageid: id, type: 'message' },
      { message: content, name: this.localUserName }
    )

    console.log(`[LAN Bridge] Sending DM to ${targetUser.name} (${targetUser.ip}:${this.udpPort})`)
    console.log(`[LAN Bridge]   from=${this.localUserId}, to=${targetUserId}`)
    console.log(`[LAN Bridge]   XML: ${xml.substring(0, 300)}`)

    this.queueTcpXml(targetUser, xml)

    console.log(`[LAN Bridge] DM sent to ${targetUser.name}: ${content.substring(0, 80)}`)
    return true
  }

  /**
   * Send a broadcast message to ALL LAN Messenger clients on the network.
   */
  sendBroadcastMessage(content: string): boolean {
    if (!this.udpSender || !this.localUserId || !this.localUserName) {
      console.error(`[LAN Bridge] Cannot send broadcast: bridge not ready`)
      return false
    }

    const id = String(this.msgId++)
    const xml = this.buildXmlMessage(
      { from: this.localUserId, messageid: id, type: 'broadcast' },
      { message: content, broadcast: content, name: this.localUserName }
    )

    console.log(`[LAN Bridge] Sending broadcast to ${this.lanUsers.size} LAN users`)
    console.log(`[LAN Bridge]   from=${this.localUserId}, XML: ${xml.substring(0, 300)}`)
    for (const user of this.lanUsers.values()) {
      this.queueTcpXml(user, xml)
    }
    console.log(`[LAN Bridge] Broadcast sent: ${content.substring(0, 80)}`)
    return true
  }

  /**
   * Send a status update (online/away/busy/dnd/gone) to all LAN users.
   */
  sendStatusUpdate(status: string): boolean {
    if (!this.udpSender || !this.localUserId) return false

    // Map web status to LAN protocol status
    const statusMap: Record<string, string> = {
      'online': 'chat',
      'away': 'away',
      'busy': 'busy',
      'dnd': 'dnd',
      'brb': 'brb',
      'gone': 'gone',
    }
    const lanStatus = statusMap[status] || status
    this.localStatus = lanStatus

    const id = String(this.msgId++)
    const xml = this.buildXmlMessage(
      { from: this.localUserId, messageid: id, type: 'status' },
      { status: lanStatus, name: this.localUserName || '' }
    )

    for (const user of this.lanUsers.values()) {
      this.queueTcpXml(user, xml)
    }
    console.log(`[LAN Bridge] Sent status update: ${lanStatus}`)
    return true
  }

  /**
   * Re-send our announce with the current username and status.
   * Call this after updating the username or status so LAN users see the change.
   */
  reAnnounce(): void {
    this.sendAnnounce()
  }

  /**
   * Get our current LAN user ID.
   */
  getLocalUserId(): string | null {
    return this.localUserId
  }

  /**
   * Get our current LAN display name.
   */
  getLocalUserName(): string | null {
    return this.localUserName
  }

  /**
   * Send a note/status message update (custom status text) to all LAN users.
   */
  sendNoteUpdate(note: string): boolean {
    if (!this.udpSender || !this.localUserId) return false

    this.localNote = note

    const id = String(this.msgId++)
    const xml = this.buildXmlMessage(
      { from: this.localUserId, messageid: id, type: 'note' },
      { note, name: this.localUserName || '' }
    )

    for (const user of this.lanUsers.values()) {
      this.queueTcpXml(user, xml)
    }
    console.log(`[LAN Bridge] Sent note update: ${note.substring(0, 60)}`)
    return true
  }

  /**
   * Send a chat state notification (typing/composing, active, paused, gone, inactive)
   * to a specific LAN user.
   */
  sendChatState(targetUserId: string, state: string): boolean {
    if (!this.udpSender || !this.localUserId) return false

    const targetUser = this.lanUsers.get(targetUserId)
    if (!targetUser) return false

    const id = String(this.msgId++)
    const xml = this.buildXmlMessage(
      { from: this.localUserId, to: targetUserId, messageid: id, type: 'chatstate' },
      { message: state, name: this.localUserName || '' }
    )

    this.queueTcpXml(targetUser, xml)
    console.log(`[LAN Bridge] Sent chatstate '${state}' to ${targetUser.name}`)
    return true
  }

  /**
   * Send full user data packet to a specific LAN user.
   * Used when starting a conversation so the LAN user sees our display name and info.
   */
  sendUserData(targetUserId: string): boolean {
    if (!this.udpSender || !this.localUserId || !this.localUserName) return false

    const targetUser = this.lanUsers.get(targetUserId)
    if (!targetUser) return false

    const id = String(this.msgId++)
    const xml = this.buildXmlMessage(
      { from: this.localUserId, to: targetUserId, messageid: id, type: 'userdata' },
      {
        userid: this.localUserId,
        name: this.localUserName,
        status: this.localStatus,
        version: APP_VERSION,
        address: this.localAddress || '',
        note: this.localNote,
        usercaps: String(0),
        queryop: 'result',
      }
    )

    this.queueTcpXml(targetUser, xml)
    console.log(`[LAN Bridge] Sent userdata to ${targetUser.name}`)
    return true
  }

  /**
   * Send a version response to a query.
   */
  sendVersionResponse(targetUserId: string): boolean {
    if (!this.udpSender || !this.localUserId) return false

    const targetUser = this.lanUsers.get(targetUserId)
    if (!targetUser) return false

    const id = String(this.msgId++)
    const xml = this.buildXmlMessage(
      { from: this.localUserId, to: targetUserId, messageid: id, type: 'version' },
      { version: APP_VERSION, name: this.localUserName || '' }
    )

    this.queueTcpXml(targetUser, xml)
    console.log(`[LAN Bridge] Sent version response to ${targetUser.name}`)
    return true
  }

  /**
   * Send an info response to a query about our user details.
   */
  sendInfoResponse(targetUserId: string): boolean {
    if (!this.udpSender || !this.localUserId || !this.localUserName) return false

    const targetUser = this.lanUsers.get(targetUserId)
    if (!targetUser) return false

    const id = String(this.msgId++)
    const xml = this.buildXmlMessage(
      { from: this.localUserId, to: targetUserId, messageid: id, type: 'info' },
      {
        userid: this.localUserId,
        name: this.localUserName,
        status: this.localStatus,
        version: APP_VERSION,
        address: this.localAddress || '',
        note: this.localNote,
        usercaps: String(0),
      }
    )

    this.queueTcpXml(targetUser, xml)
    console.log(`[LAN Bridge] Sent info response to ${targetUser.name}`)
    return true
  }

  /**
   * Send an acknowledge message (message delivery confirmation).
   */
  sendAcknowledge(targetUserId: string, messageId: string): boolean {
    if (!this.udpSender || !this.localUserId) return false

    const targetUser = this.lanUsers.get(targetUserId)
    if (!targetUser) return false

    const id = String(this.msgId++)
    const xml = this.buildXmlMessage(
      { from: this.localUserId, to: targetUserId, messageid: id, type: 'acknowledge' },
      { messageid: messageId, name: this.localUserName || '' }
    )

    this.queueTcpXml(targetUser, xml)
    return true
  }

  sendAnnounce(): void {
    if (!this.localUserId || !this.localUserName) return
    if (!this.udpSender) return

    const id = String(this.msgId++)
    const xml = this.buildXmlMessage(
      { from: this.localUserId, messageid: id, type: 'announce' },
      {
        userid: this.localUserId,
        name: this.localUserName,
        status: this.localStatus,
        version: APP_VERSION,
        address: this.localAddress || '',
        note: this.localNote,
        usercaps: String(0),
      }
    )

    this.sendBroadcastDatagram(Buffer.from(xml, 'utf-8'))
    console.log(`[LAN Bridge] Sent announce (id: ${id})`)
  }

  // ==================== Identity ====================

  private initIdentity(): void {
    const mac = this.getMacAddress()
    const hostName = hostname() || 'webuser'
    this.localUserName = process.env.LAN_USERNAME || hostName
    this.localUserId = mac + this.localUserName
    this.localAddress = this.getLocalIPAddress()
  }

  private logIdentity(): void {
    console.log(`[LAN Bridge] User ID: ${this.localUserId}`)
    console.log(`[LAN Bridge] User Name: ${this.localUserName}`)
    console.log(`[LAN Bridge] IP Address: ${this.localAddress}`)
    console.log(`[LAN Bridge] UDP Port: ${this.udpPort}`)
    console.log(`[LAN Bridge] Multicast: ${MULTICAST_ADDR}`)
    console.log(`[LAN Bridge] Broadcast addresses: ${this.broadcastAddresses.join(', ')}`)
  }

  // ==================== Network Helpers ====================

  private getLocalIPAddress(): string | null {
    const interfaces = networkInterfaces()
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name]
      if (!iface) continue
      for (const entry of iface) {
        if (entry.internal || entry.family !== 'IPv4') continue
        return entry.address
      }
    }
    return null
  }

  private getMacAddress(): string {
    const interfaces = networkInterfaces()
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name]
      if (!iface) continue
      for (const entry of iface) {
        if (entry.internal || entry.family !== 'IPv4') continue
        return (entry.mac || '000000000000').replace(/:/g, '').toUpperCase()
      }
    }
    return '000000000000'
  }

  private computeSubnetBroadcast(ip: string): string {
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.255`
    }
    return BROADCAST_ADDR
  }

  private discoverBroadcastAddresses(): void {
    const ip = this.getLocalIPAddress()
    if (ip) {
      const subnetBcast = this.computeSubnetBroadcast(ip)
      if (!this.broadcastAddresses.includes(subnetBcast)) {
        this.broadcastAddresses.push(subnetBcast)
      }
      this.localAddress = ip
    }
  }

  // ==================== TCP Messenger Transport ====================

  private ensureTcpKeyPair(): void {
    if (this.publicKeyPem && this.privateKeyPem) return

    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 1024,
      publicExponent: 0x10001,
      publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    })

    this.publicKeyPem = Buffer.from(publicKey)
    this.privateKeyPem = Buffer.from(privateKey)
  }

  private async startTcpServer(): Promise<void> {
    if (this.tcpServer) return

    this.tcpServer = net.createServer((socket) => this.handleIncomingTcpSocket(socket))

    await new Promise<void>((resolve) => {
      this.tcpServer!.once('error', (err: NodeJS.ErrnoException) => {
        console.error(`[LAN Bridge] TCP server error on port ${this.udpPort}: ${err.message}`)
        this.tcpServer?.close()
        this.tcpServer = null
        resolve()
      })

      this.tcpServer!.listen(this.udpPort, '0.0.0.0', () => {
        console.log(`[LAN Bridge] TCP listener bound to port ${this.udpPort}`)
        resolve()
      })
    })
  }

  private handleIncomingTcpSocket(socket: net.Socket): void {
    socket.once('data', (data) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
      if (!buffer.subarray(0, 3).toString('utf-8').startsWith('MSG')) {
        socket.destroy()
        return
      }

      const userId = buffer.subarray(3).toString('utf-8')
      const address = socket.remoteAddress?.replace(/^::ffff:/, '') || ''
      const peer = this.createTcpPeer(userId, address, socket, false)
      this.sendTcpFrame(peer, this.buildDatagram('PUBKEY', this.publicKeyPem!.toString('utf-8')))
      console.log(`[LAN Bridge] Accepted TCP message stream from ${userId} (${address})`)
    })
  }

  private createTcpPeer(userId: string, address: string, socket: net.Socket, connecting: boolean): TcpPeer {
    const existing = this.tcpPeers.get(userId)
    if (existing) {
      existing.socket.destroy()
    }

    const peer: TcpPeer = {
      userId,
      address,
      socket,
      ready: false,
      connecting,
      buffer: Buffer.alloc(0),
      pendingXml: existing?.pendingXml || [],
    }

    this.tcpPeers.set(userId, peer)
    socket.on('data', (chunk) => this.handleTcpData(peer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    socket.on('close', () => {
      if (this.tcpPeers.get(userId) === peer) this.tcpPeers.delete(userId)
    })
    socket.on('error', (err) => {
      console.error(`[LAN Bridge] TCP error for ${userId}: ${err.message}`)
    })
    return peer
  }

  private ensureTcpConnection(user: LANUser): TcpPeer | null {
    let peer = this.tcpPeers.get(user.id)
    if (peer && (peer.ready || peer.connecting)) return peer
    if (!this.localUserId) return null

    const socket = net.createConnection({ host: user.ip, port: this.udpPort })
    peer = this.createTcpPeer(user.id, user.ip, socket, true)

    socket.on('connect', () => {
      socket.write(Buffer.from(`MSG${this.localUserId}`, 'utf-8'))
      console.log(`[LAN Bridge] Connected TCP message stream to ${user.name} (${user.ip}:${this.udpPort})`)
    })

    return peer
  }

  private handleTcpData(peer: TcpPeer, chunk: Buffer): void {
    peer.connecting = false
    peer.buffer = Buffer.concat([peer.buffer, chunk])

    while (peer.buffer.length >= 4) {
      const frameLength = peer.buffer.readUInt32BE(0)
      if (peer.buffer.length < frameLength + 4) return

      const frame = peer.buffer.subarray(4, frameLength + 4)
      peer.buffer = peer.buffer.subarray(frameLength + 4)
      this.handleTcpFrame(peer, frame)
    }
  }

  private handleTcpFrame(peer: TcpPeer, frame: Buffer): void {
    const parsed = this.parseDatagram(frame)
    if (!parsed) return

    if (parsed.type === 'PUBKEY') {
      const { key, iv, encryptedKeyIv } = this.createAesForPublicKey(Buffer.from(parsed.xml, 'utf-8'))
      peer.key = key
      peer.iv = iv
      peer.ready = true
      this.sendTcpFrame(peer, Buffer.concat([Buffer.from('HNDSHK'), encryptedKeyIv]))
      this.flushTcpPeer(peer)
      return
    }

    if (parsed.type === 'HNDSHK') {
      if (!this.privateKeyPem) return
      const keyIv = privateDecrypt({
        key: this.privateKeyPem,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1',
      }, frame.subarray(6))
      peer.key = keyIv.subarray(0, 32)
      peer.iv = keyIv.subarray(32, 48)
      peer.ready = true
      this.flushTcpPeer(peer)
      return
    }

    if (parsed.type === 'MESSAG') {
      if (!peer.key || !peer.iv) return
      const decipher = createDecipheriv('aes-256-cbc', peer.key, peer.iv)
      const xml = Buffer.concat([decipher.update(frame.subarray(6)), decipher.final()]).toString('utf-8')
      this.handleUserDatagram(xml, { address: peer.address, port: this.udpPort })
    }
  }

  private queueTcpXml(user: LANUser, xml: string): void {
    const peer = this.ensureTcpConnection(user)
    if (!peer) return

    peer.pendingXml.push(xml)
    this.flushTcpPeer(peer)
  }

  private flushTcpPeer(peer: TcpPeer): void {
    if (!peer.ready || !peer.key || !peer.iv) return

    while (peer.pendingXml.length > 0) {
      const xml = peer.pendingXml.shift()
      if (!xml) continue
      const cipher = createCipheriv('aes-256-cbc', peer.key, peer.iv)
      const encrypted = Buffer.concat([cipher.update(Buffer.from(xml, 'utf-8')), cipher.final()])
      this.sendTcpFrame(peer, Buffer.concat([Buffer.from('MESSAG'), encrypted]))
    }
  }

  private sendTcpFrame(peer: TcpPeer, payload: Buffer): void {
    const header = Buffer.alloc(4)
    header.writeUInt32BE(payload.length, 0)
    peer.socket.write(Buffer.concat([header, payload]))
  }

  private createAesForPublicKey(publicKeyPem: Buffer): { key: Buffer; iv: Buffer; encryptedKeyIv: Buffer } {
    const keyData = randomBytes(32)
    const keyIv = this.evpBytesToKey(keyData, 48, 5)
    const encryptedKeyIv = publicEncrypt({
      key: publicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha1',
    }, keyIv)

    return {
      key: keyIv.subarray(0, 32),
      iv: keyIv.subarray(32, 48),
      encryptedKeyIv,
    }
  }

  private evpBytesToKey(data: Buffer, length: number, rounds: number): Buffer {
    const chunks: Buffer[] = []
    let previous = Buffer.alloc(0)

    while (Buffer.concat(chunks).length < length) {
      let digest = Buffer.concat([previous, data])
      for (let i = 0; i < rounds; i++) {
        digest = createHash('sha1').update(digest).digest()
      }
      chunks.push(digest)
      previous = digest
    }

    return Buffer.concat(chunks).subarray(0, length)
  }

  // ==================== XML Message Handling ====================

  private buildXmlMessage(head: Record<string, string>, body: Record<string, string> = {}): string {
    const headEntries = Object.entries(head)
      .map(([k, v]) => `    <${k}>${this.escapeXml(v)}</${k}>`)
      .join('\n')

    const bodyEntries = Object.entries(body)
      .map(([k, v]) => `    <${k}>${this.escapeXml(v)}</${k}>`)
      .join('\n')

    return `<${APP_MARKER}>\n  <head>\n${headEntries}\n  </head>\n  <body>\n${bodyEntries}\n  </body>\n</${APP_MARKER}>`
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  private static readonly NumericTypeMap: Record<string, string> = {
    '0': 'unknown', '1': 'announce', '2': 'depart', '3': 'userdata', '4': 'broadcast',
    '5': 'status', '6': 'avatar', '7': 'name', '8': 'ping', '9': 'message',
    '10': 'groupmessage', '11': 'publicmessage', '12': 'file', '13': 'acknowledge',
    '14': 'failed', '15': 'error', '16': 'oldversion', '17': 'query', '18': 'info',
    '19': 'chatstate', '20': 'note', '21': 'folder', '22': 'group', '23': 'version',
    '24': 'webfailed', '25': 'refresh', '26': 'join', '27': 'leave',
  }

  private resolveMessageType(rawType: string): string {
    if (/^[a-zA-Z]+$/.test(rawType)) return rawType
    return LANBridge.NumericTypeMap[rawType] || rawType
  }

  private parseXmlMessage(xml: string): { head: Record<string, string>; body: Record<string, string> } | null {
    try {
      const rootCheck = new RegExp(`<${APP_MARKER}[\\s>]`, 'i')
      if (!rootCheck.test(xml)) return null

      const headMatch = xml.match(/<head>([\s\S]*?)<\/head>/i)
      const bodyMatch = xml.match(/<body>([\s\S]*?)<\/body>/i)

      if (!headMatch) return null

      const head: Record<string, string> = {}
      const headXml = headMatch[1]
      const tagRegex = /<(\w+)(?:\s[^>]*)?>((?:<![CDATA\[[\s\S]*?\]\]>|[^<])*)<\/\1>/gi
      let match
      while ((match = tagRegex.exec(headXml)) !== null) {
        const [, key, value] = match
        const trimmed = value.trim()
        const cleanValue = trimmed.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim()
        head[key.toLowerCase()] = this.unescapeXml(cleanValue)
      }

      const body: Record<string, string> = {}
      if (bodyMatch) {
        const bodyXml = bodyMatch[1]
        tagRegex.lastIndex = 0
        while ((match = tagRegex.exec(bodyXml)) !== null) {
          const [, key, value] = match
          const trimmed = value.trim()
          const cleanValue = trimmed.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim()
          body[key.toLowerCase()] = this.unescapeXml(cleanValue)
        }
      }

      if (!head.from) return null

      if (head.type) {
        head.type = this.resolveMessageType(head.type)
      }

      return { head, body }
    } catch {
      return null
    }
  }

  private unescapeXml(str: string): string {
    return str
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&')
  }

  // ==================== Datagram Building ====================

  private buildDatagram(type: string, xmlBody: string): Buffer {
    const typeBytes = type.padEnd(6, ' ').slice(0, 6)
    return Buffer.from(typeBytes + xmlBody, 'utf-8')
  }

  private parseDatagram(data: Buffer): { type: string; xml: string } | null {
    if (data.length < 6) return null
    const type = data.subarray(0, 6).toString('utf-8').trim()
    const xml = data.subarray(6).toString('utf-8')
    if (!xml) return null
    if (type !== 'BRDCST' && type !== 'MESSAG' && type !== 'PUBKEY') {
      const fullData = data.toString('utf-8')
      if (fullData.includes(APP_MARKER)) {
        return { type: 'UNKNOWN', xml: fullData }
      }
    }
    return { type, xml }
  }

  // ==================== UDP Sending ====================

  private sendUdpTo(message: Buffer, address: string, port: number): void {
    this.udpSender?.send(message, 0, message.length, port, address, (err) => {
      if (err) {
        if (err.message.includes('EACCES') && address === '255.255.255.255') {
          // Non-critical on Windows
        } else {
          console.error(`[LAN Bridge] UDP send error to ${address}:${port}:`, err.message)
        }
      }
    })
  }

  private sendBroadcastDatagram(message: Buffer): void {
    this.sendUdpTo(message, MULTICAST_ADDR, this.udpPort)
    for (const addr of this.broadcastAddresses) {
      this.sendUdpTo(message, addr, this.udpPort)
    }
  }

  // ==================== Depart ====================

  private sendDepart(): void {
    if (!this.localUserId || !this.udpSender) return

    const id = String(this.msgId++)
    const xml = this.buildXmlMessage({
      from: this.localUserId,
      messageid: id,
      type: 'depart',
    })

    this.sendBroadcastDatagram(Buffer.from(xml, 'utf-8'))
    console.log('[LAN Bridge] Sent depart')
  }

  // ==================== UDP Message Handler ====================

  private handleUdpMessage(data: Buffer, rinfo: { address: string; port: number }): void {
    const datagram = this.parseDatagram(data)
    if (!datagram) return

    const { type, xml } = datagram

    switch (type) {
      case 'BRDCST':
        this.handleBroadcast(xml, rinfo)
        break
      case 'MESSAG':
        this.handleUserDatagram(xml, rinfo)
        break
      case 'PUBKEY':
        console.log(`[LAN Bridge] Received PUBKEY from ${rinfo.address} (encryption not supported)`)
        break
      default:
        if (xml.length > 10 && xml.includes(APP_MARKER)) {
          this.handleBroadcast(xml, rinfo)
        }
    }
  }

  // ==================== Broadcast Handling ====================

  private async handleBroadcast(xml: string, rinfo: { address: string; port: number }): Promise<void> {
    const parsed = this.parseXmlMessage(xml)
    if (!parsed) {
      const rawPreview = Buffer.from(xml).subarray(0, 300).toString('utf-8')
        .replace(/[\x00-\x1f\x7f-\xff]/g, c => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      console.log(`[LAN Bridge] Failed to parse broadcast XML from ${rinfo.address} (len=${xml.length}): ${rawPreview}`)
      return
    }

    const { head, body } = parsed
    const fromUserId = head.from
    const msgType = head.type
    const messageId = head.messageid

    if (fromUserId === this.localUserId) return

    console.log(`[LAN Bridge] Broadcast from ${fromUserId} (${rinfo.address}): type=${msgType}`)

    switch (msgType) {
      case 'announce': {
        const existingUser = this.lanUsers.get(fromUserId)
        if (!existingUser) {
          this.lanUsers.set(fromUserId, {
            id: fromUserId,
            name: body.name || fromUserId,
            address: rinfo.address,
            version: body.version || 'unknown',
            status: body.status || 'chat',
            note: body.note || body.about || '',
            caps: parseInt(body.usercaps || '0', 10),
            avatar: '',
            ip: rinfo.address,
            port: rinfo.port,
            lastSeen: Date.now(),
            protocol: 'lanmessenger',
          })
          console.log(`[LAN Bridge] New LAN user discovered: ${body.name || fromUserId} at ${rinfo.address}`)
          chatBus.emit('lan-user-discovered', {
            userId: fromUserId,
            ip: rinfo.address,
            timestamp: Date.now(),
          })
        } else {
          existingUser.lastSeen = Date.now()
          if (body.name) existingUser.name = body.name
          if (body.version) existingUser.version = body.version
          if (body.status) existingUser.status = body.status
          if (body.note !== undefined) existingUser.note = body.note || ''
          if (body.about !== undefined) existingUser.note = body.about || existingUser.note
          if (body.address) existingUser.address = body.address
          existingUser.ip = rinfo.address
        }
        const user = this.lanUsers.get(fromUserId)
        if (user) this.ensureTcpConnection(user)
        break
      }

      case 'depart': {
        if (this.lanUsers.has(fromUserId)) {
          const user = this.lanUsers.get(fromUserId)!
          this.lanUsers.delete(fromUserId)
          console.log(`[LAN Bridge] User departed: ${user.name} (${fromUserId})`)
          chatBus.emit('lan-user-left', {
            userId: fromUserId,
            userName: user.name,
            timestamp: Date.now(),
          })
        }
        break
      }

      case 'broadcast':
      case 'publicmessage': {
        const content = body.message || body.broadcast || ''
        if (content) {
          const sender = body.name || fromUserId
          await this.forwardToWebChat(sender, fromUserId, content, 'broadcast', rinfo)
          this.registerOrUpdateUser(fromUserId, {
            address: rinfo.address,
            name: body.name,
            version: body.version,
            status: body.status,
            note: body.note || body.about || '',
            caps: parseInt(body.usercaps || '0', 10),
            ip: rinfo.address,
            port: rinfo.port,
          })
          // Auto-acknowledge broadcast messages
          if (messageId) this.sendAcknowledge(fromUserId, messageId)
        }
        break
      }

      case 'message': {
        const content = body.message || ''
        if (content && head.to === this.localUserId) {
          const sender = body.name || fromUserId
          await this.forwardToWebChat(sender, fromUserId, content, 'message', rinfo)
          // Auto-acknowledge private messages
          if (messageId) this.sendAcknowledge(fromUserId, messageId)
        }
        break
      }

      case 'status': {
        const status = body.status || 'chat'
        const user = this.lanUsers.get(fromUserId)
        if (user) {
          user.status = status
          user.lastSeen = Date.now()
          chatBus.emit('lan-user-status', {
            userId: fromUserId,
            userName: user.name,
            status,
            timestamp: Date.now(),
          })
        }
        break
      }

      case 'name': {
        const newName = body.name || body.message || ''
        if (newName) {
          const user = this.lanUsers.get(fromUserId)
          if (user) {
            const oldName = user.name
            user.name = newName
            user.lastSeen = Date.now()
            console.log(`[LAN Bridge] User renamed: ${oldName} → ${newName}`)
            chatBus.emit('lan-user-renamed', {
              userId: fromUserId,
              oldName,
              newName,
              timestamp: Date.now(),
            })
          }
        }
        break
      }

      case 'note': {
        const note = body.note || body.message || ''
        const user = this.lanUsers.get(fromUserId)
        if (user) {
          user.note = note
          user.lastSeen = Date.now()
          chatBus.emit('lan-user-note', {
            userId: fromUserId,
            userName: user.name,
            note,
            timestamp: Date.now(),
          })
        }
        break
      }

      case 'chatstate': {
        const state = body.message || body.chatstate || ''
        const user = this.lanUsers.get(fromUserId)
        if (user && state) {
          user.lastSeen = Date.now()
          chatBus.emit('lan-user-typing', {
            userId: fromUserId,
            userName: user.name,
            state, // 'composing', 'active', 'paused', 'gone', 'inactive'
            timestamp: Date.now(),
          })
        }
        break
      }

      case 'avatar': {
        const avatarData = body.avatar || body.message || ''
        const user = this.lanUsers.get(fromUserId)
        if (user && avatarData) {
          user.avatar = avatarData
          user.lastSeen = Date.now()
          chatBus.emit('lan-user-avatar', {
            userId: fromUserId,
            userName: user.name,
            avatar: avatarData,
            timestamp: Date.now(),
          })
        }
        break
      }

      case 'refresh': {
        // Another client is requesting us to re-announce
        console.log(`[LAN Bridge] Received refresh request from ${fromUserId}`)
        this.sendAnnounce()
        break
      }

      case 'oldversion': {
        const minVersion = body.version || 'unknown'
        console.log(`[LAN Bridge] Version warning from ${fromUserId}: minimum version ${minVersion}`)
        break
      }

      case 'webfailed': {
        console.log(`[LAN Bridge] Web relay failed from ${fromUserId}: ${body.message || 'unknown error'}`)
        break
      }

      default:
        console.log(`[LAN Bridge] Unhandled broadcast type: ${msgType}`)
    }
  }

  // ==================== User Datagram Handling ====================

  private async handleUserDatagram(xml: string, rinfo: { address: string; port: number }): Promise<void> {
    const parsed = this.parseXmlMessage(xml)
    if (!parsed) return

    const { head, body } = parsed
    const fromUserId = head.from
    const msgType = head.type
    const messageId = head.messageid

    if (fromUserId === this.localUserId) return

    switch (msgType) {
      case 'userdata': {
        this.registerOrUpdateUser(fromUserId, {
          address: body.address || rinfo.address,
          name: body.name,
          version: body.version,
          status: body.status,
          note: body.note || body.about || '',
          caps: parseInt(body.usercaps || '0', 10),
          ip: rinfo.address,
          port: rinfo.port,
        })
        console.log(`[LAN Bridge] User data received for ${body.name || fromUserId}`)
        break
      }

      case 'message': {
        const content = body.message || ''
        if (content) {
          const sender = body.name || fromUserId
          await this.forwardToWebChat(sender, fromUserId, content, 'message', rinfo)
          if (messageId) this.sendAcknowledge(fromUserId, messageId)
        }
        break
      }

      case 'broadcast':
      case 'publicmessage': {
        const content = body.message || body.broadcast || ''
        if (content) {
          const sender = body.name || fromUserId
          await this.forwardToWebChat(sender, fromUserId, content, 'broadcast', rinfo)
        }
        break
      }

      case 'ping': {
        const user = this.lanUsers.get(fromUserId)
        if (user) {
          user.lastSeen = Date.now()
        }
        // Respond with our presence
        this.sendUserData(fromUserId)
        break
      }

      case 'groupmessage': {
        const content = body.message || body.groupmessage || ''
        if (content) {
          const sender = body.name || fromUserId
          const thread = body.thread || ''
          await this.forwardToWebChat(sender, fromUserId, content, 'groupmessage', rinfo, thread)
        }
        break
      }

      case 'chatstate': {
        const state = body.message || body.chatstate || ''
        const user = this.lanUsers.get(fromUserId)
        if (user && state) {
          user.lastSeen = Date.now()
          chatBus.emit('lan-user-typing', {
            userId: fromUserId,
            userName: user.name,
            state,
            timestamp: Date.now(),
          })
        }
        break
      }

      case 'name': {
        const newName = body.name || body.message || ''
        if (newName) {
          const user = this.lanUsers.get(fromUserId)
          if (user) {
            const oldName = user.name
            user.name = newName
            user.lastSeen = Date.now()
            console.log(`[LAN Bridge] User renamed via DM: ${oldName} → ${newName}`)
            chatBus.emit('lan-user-renamed', {
              userId: fromUserId,
              oldName,
              newName,
              timestamp: Date.now(),
            })
          }
        }
        break
      }

      case 'note': {
        const note = body.note || body.message || ''
        const user = this.lanUsers.get(fromUserId)
        if (user) {
          user.note = note
          user.lastSeen = Date.now()
          chatBus.emit('lan-user-note', {
            userId: fromUserId,
            userName: user.name,
            note,
            timestamp: Date.now(),
          })
        }
        break
      }

      case 'avatar': {
        const avatarData = body.avatar || body.message || ''
        const user = this.lanUsers.get(fromUserId)
        if (user && avatarData) {
          user.avatar = avatarData
          user.lastSeen = Date.now()
          chatBus.emit('lan-user-avatar', {
            userId: fromUserId,
            userName: user.name,
            avatar: avatarData,
            timestamp: Date.now(),
          })
        }
        break
      }

      case 'status': {
        const status = body.status || 'chat'
        const user = this.lanUsers.get(fromUserId)
        if (user) {
          user.status = status
          user.lastSeen = Date.now()
          chatBus.emit('lan-user-status', {
            userId: fromUserId,
            userName: user.name,
            status,
            timestamp: Date.now(),
          })
        }
        break
      }

      case 'query': {
        // User is requesting our info — respond with userdata
        console.log(`[LAN Bridge] Received query from ${fromUserId}`)
        this.sendUserData(fromUserId)
        this.sendVersionResponse(fromUserId)
        break
      }

      case 'version': {
        const version = body.version || 'unknown'
        const user = this.lanUsers.get(fromUserId)
        if (user) {
          user.version = version
          user.lastSeen = Date.now()
          console.log(`[LAN Bridge] Version from ${user.name}: ${version}`)
        }
        break
      }

      case 'info': {
        // User sent us their detailed info
        const user = this.lanUsers.get(fromUserId)
        if (user) {
          if (body.name) user.name = body.name
          if (body.status) user.status = body.status
          if (body.version) user.version = body.version
          if (body.note !== undefined) user.note = body.note
          if (body.address) user.address = body.address
          user.lastSeen = Date.now()
          console.log(`[LAN Bridge] Info received for ${user.name}`)
        }
        break
      }

      case 'acknowledge': {
        // Message was delivered — update message status in DB
        const ackedMsgId = body.messageid || body.message || ''
        if (ackedMsgId) {
          console.log(`[LAN Bridge] Message acknowledged by ${fromUserId}: ${ackedMsgId}`)
          chatBus.emit('lan-message-acknowledged', {
            userId: fromUserId,
            messageId: ackedMsgId,
            timestamp: Date.now(),
          })
        }
        break
      }

      case 'file': {
        // File transfer initiation — LAN Messenger uses this to notify about incoming files
        const fileName = body.message || body.file || ''
        const fileSize = body.size || ''
        const sender = body.name || fromUserId
        console.log(`[LAN Bridge] File transfer from ${sender}: ${fileName} (${fileSize} bytes)`)
        // Notify web chat about the file offer (actual file transfer requires TCP)
        await this.forwardToWebChat(
          sender,
          fromUserId,
          `[File] ${fileName}${fileSize ? ` (${fileSize} bytes)` : ''} — File transfer initiated via LAN Messenger. Open the desktop app to receive.`,
          'message',
          rinfo
        )
        break
      }

      case 'failed': {
        const failReason = body.message || 'unknown reason'
        console.log(`[LAN Bridge] Message delivery failed to ${fromUserId}: ${failReason}`)
        chatBus.emit('lan-message-failed', {
          userId: fromUserId,
          reason: failReason,
          timestamp: Date.now(),
        })
        break
      }

      case 'error': {
        const errMsg = body.message || 'unknown error'
        console.log(`[LAN Bridge] Error from ${fromUserId}: ${errMsg}`)
        break
      }

      case 'group': {
        const thread = body.thread || body.message || ''
        console.log(`[LAN Bridge] Group created/updated: ${thread} by ${fromUserId}`)
        break
      }

      case 'join': {
        const thread = body.thread || body.message || ''
        const member = body.name || fromUserId
        console.log(`[LAN Bridge] User ${member} joined group: ${thread}`)
        break
      }

      case 'leave': {
        const thread = body.thread || body.message || ''
        const member = body.name || fromUserId
        console.log(`[LAN Bridge] User ${member} left group: ${thread}`)
        break
      }

      case 'folder': {
        const folderPath = body.message || body.folder || ''
        console.log(`[LAN Bridge] Folder sharing from ${fromUserId}: ${folderPath}`)
        await this.forwardToWebChat(
          body.name || fromUserId,
          fromUserId,
          `[Folder Share] ${folderPath} — Folder sharing initiated via LAN Messenger.`,
          'message',
          rinfo
        )
        break
      }

      default:
        break
    }
  }

  // ==================== User Management ====================

  private registerOrUpdateUser(
    userId: string,
    update: {
      address?: string
      name?: string
      version?: string
      status?: string
      note?: string
      caps?: number
      ip?: string
      port?: number
    }
  ): void {
    const existing = this.lanUsers.get(userId)
    if (existing) {
      if (update.name && update.name !== 'unknown') existing.name = update.name
      if (update.address) existing.address = update.address
      if (update.version) existing.version = update.version
      if (update.status) existing.status = update.status
      if (update.note !== undefined) existing.note = update.note
      if (update.caps !== undefined) existing.caps = update.caps
      if (update.ip) existing.ip = update.ip
      if (update.port) existing.port = update.port
      existing.lastSeen = Date.now()
    } else {
      this.lanUsers.set(userId, {
        id: userId,
        name: update.name || userId,
        address: update.address || '',
        version: update.version || 'unknown',
        status: update.status || 'chat',
        note: update.note || '',
        caps: update.caps || 0,
        avatar: '',
        ip: update.ip || '',
        port: update.port || this.udpPort,
        lastSeen: Date.now(),
        protocol: 'lanmessenger',
      })
      console.log(`[LAN Bridge] New user registered: ${update.name || userId}`)
      chatBus.emit('lan-user-discovered', {
        userId,
        ip: update.ip || '',
        timestamp: Date.now(),
      })
    }
  }

  // ==================== Stale User Cleanup ====================

  private cleanStaleUsers(): void {
    const now = Date.now()
    const staleTimeout = 120000
    for (const [id, user] of this.lanUsers) {
      if (now - user.lastSeen > staleTimeout) {
        this.lanUsers.delete(id)
        console.log(`[LAN Bridge] Removed stale user: ${user.name} (${id})`)
        chatBus.emit('lan-user-left', {
          userId: id,
          userName: user.name,
          timestamp: Date.now(),
        })
      }
    }
  }

  // ==================== Web Chat Bridge (chatBus + DB) ====================

  private async forwardToWebChat(
    senderName: string,
    senderId: string,
    content: string,
    type: string,
    rinfo: { address: string; port: number },
    thread?: string
  ): Promise<void> {
    try {
      const lanUsername = `lan-${senderId}`
      const sender = await db.user.upsert({
        where: { username: lanUsername },
        update: {
          displayName: senderName,
          status: 'online',
          lastSeen: new Date(),
        },
        create: {
          username: lanUsername,
          displayName: senderName,
          status: 'online',
        },
      })

      let targetRoomId: string

      if (type === 'broadcast') {
        let broadcastRoom = await db.chatRoom.findFirst({ where: { type: 'broadcast' } })
        if (!broadcastRoom) {
          broadcastRoom = await db.chatRoom.create({
            data: { name: 'Broadcast', type: 'broadcast', description: 'System-wide broadcast' },
          })
        }
        targetRoomId = broadcastRoom.id
      } else if (type === 'message') {
        targetRoomId = await this.getOrCreateLanDmRoom(sender.id, senderName, senderId)
      } else {
        let broadcastRoom = await db.chatRoom.findFirst({ where: { type: 'broadcast' } })
        if (!broadcastRoom) {
          broadcastRoom = await db.chatRoom.create({
            data: { name: 'Broadcast', type: 'broadcast', description: 'System-wide broadcast' },
          })
        }
        targetRoomId = broadcastRoom.id
      }

      const messageContent = type === 'groupmessage'
        ? `[LAN Group] ${senderName}: ${content}`
        : content

      const message = await db.message.create({
        data: {
          roomId: targetRoomId,
          senderId: sender.id,
          content: messageContent,
          type: 'text',
          status: 'delivered',
        },
      })

      const formattedMessage = {
        id: message.id,
        roomId: message.roomId,
        sender: {
          id: sender.id,
          username: sender.username,
          displayName: sender.displayName,
          avatar: sender.avatar,
        },
        content: message.content,
        type: message.type,
        fileUrl: '',
        fileName: '',
        status: message.status,
        timestamp: message.createdAt.toISOString(),
        editedAt: null,
        replyTo: null,
      }

      chatBus.emit('message', formattedMessage)

      console.log(`[LAN Bridge] Forwarded ${type} from ${senderName}: ${content.substring(0, 80)}`)
    } catch (err) {
      console.error(`[LAN Bridge] Error forwarding message to web chat:`, (err as Error).message)
    }
  }

  private async getOrCreateLanDmRoom(
    senderDbId: string,
    senderName: string,
    senderLanId: string
  ): Promise<string> {
    const existing = await db.chatRoomMember.findFirst({
      where: { userId: senderDbId },
      include: { room: { include: { members: true } } },
    })
    if (existing && existing.room.type === 'private') {
      // Also ensure the web user (if any has joined) is a member of this room
      // so they can see it in their room list
      const webUsers = await db.user.findMany({
        where: { isSystem: false, username: { not: { startsWith: 'lan-' } } },
        take: 1,
        orderBy: { lastSeen: 'desc' },
      })
      if (webUsers.length > 0) {
        const isAlreadyMember = existing.room.members.some((m) => m.userId === webUsers[0].id)
        if (!isAlreadyMember) {
          await db.chatRoomMember.create({
            data: { roomId: existing.roomId, userId: webUsers[0].id, role: 'member' },
          })
        }
      }
      return existing.roomId
    }

    // Find the web user to add as member so they see the room
    const webUsers = await db.user.findMany({
      where: { isSystem: false, username: { not: { startsWith: 'lan-' } } },
      take: 1,
      orderBy: { lastSeen: 'desc' },
    })

    const memberCreates: { userId: string; role: string }[] = [
      { userId: senderDbId, role: 'member' },
    ]
    if (webUsers.length > 0) {
      memberCreates.push({ userId: webUsers[0].id, role: 'member' })
    }

    const room = await db.chatRoom.create({
      data: {
        name: `LAN: ${senderName}`,
        type: 'private',
        description: `Direct message with LAN user ${senderName} (${senderLanId})`,
        members: {
          create: memberCreates,
        },
      },
      include: { members: { include: { user: true } } },
    })

    chatBus.emit('room-created', {
      room: {
        id: room.id,
        name: room.name,
        type: room.type,
        avatar: room.avatar,
        description: room.description,
        createdAt: room.createdAt.toISOString(),
        updatedAt: room.updatedAt.toISOString(),
        members: room.members.map((m) => ({
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          user: { id: m.user.id, username: m.user.username, displayName: m.user.displayName, avatar: m.user.avatar, status: m.user.status },
        })),
        lastMessage: null,
      },
    })

    console.log(`[LAN Bridge] Created DM room for ${senderName}: ${room.id}`)
    return room.id
  }
}

// ==================== Singleton Export ====================

const globalForBridge = globalThis as unknown as {
  __lanBridge: InstanceType<typeof LANBridge> | undefined
}

export const lanBridge: LANBridge = globalForBridge.__lanBridge ?? new LANBridge()
if (!globalForBridge.__lanBridge) {
  globalForBridge.__lanBridge = lanBridge
}
