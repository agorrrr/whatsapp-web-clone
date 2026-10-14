import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  Browsers,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { EventEmitter } from 'events';
import {
  readDb,
  writeDb,
  saveMessage,
  findUserById,
  updateUserProfile,
  getChatRoomId,
} from './db';
import { Message, MessageType, UserAccount, GroupChat } from '../types/chat';

export type BaileysConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'qrcode'
  | 'pairing'
  | 'connected'
  | 'error'
  | 'disconnected';

export interface BaileysState {
  status: BaileysConnectionStatus;
  qrCode: string | null;
  pairingCode: string | null;
  user: {
    id: string;
    phone: string;
    name: string;
    avatar?: string;
    about?: string;
  } | null;
  linkedUserId: string | null;
  lastError: string | null;
  connectedAt: string | null;
}

const baileysEvents = new EventEmitter();
baileysEvents.setMaxListeners(50);

export function onBaileysEvent(callback: (evt: { type: string; [key: string]: any }) => void) {
  baileysEvents.on('event', callback);
  return () => {
    baileysEvents.off('event', callback);
  };
}

// Global in-memory singleton to persist connection across Next.js API requests
declare global {
  // eslint-disable-next-line no-var
  var __baileysSocket: WASocket | null | undefined;
  // eslint-disable-next-line no-var
  var __baileysState: BaileysState | undefined;
}

const DEFAULT_STATE: BaileysState = {
  status: 'idle',
  qrCode: null,
  pairingCode: null,
  user: null,
  linkedUserId: null,
  lastError: null,
  connectedAt: null,
};

function getState(): BaileysState {
  if (!global.__baileysState) {
    global.__baileysState = { ...DEFAULT_STATE };
  }
  return global.__baileysState;
}

function getAuthFolder(): string {
  // On Vercel / serverless, process.cwd() is strictly read-only.
  // ALWAYS use os.tmpdir() to prevent EROFS read-only crashes during login handshake.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDir = path.join(os.tmpdir(), 'baileys_auth');
    if (!fs.existsSync(tmpDir)) {
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
      } catch {}
    }
    return tmpDir;
  }

  try {
    const localDir = path.join(process.cwd(), 'data', 'baileys_auth');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return localDir;
  } catch {
    const tmpDir = path.join(os.tmpdir(), 'baileys_auth');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
}

// Helper to extract text & media type from WhatsApp raw message
function extractMessageContent(msg: proto.IWebMessageInfo): {
  type: MessageType;
  text?: string;
  mediaUrl?: string;
} {
  const content = msg.message;
  if (!content) return { type: 'text', text: '' };

  if (content.conversation) {
    return { type: 'text', text: content.conversation };
  }
  if (content.extendedTextMessage?.text) {
    return { type: 'text', text: content.extendedTextMessage.text };
  }
  if (content.imageMessage) {
    return {
      type: 'image',
      text: content.imageMessage.caption || '',
      mediaUrl: content.imageMessage.url || '',
    };
  }
  if (content.audioMessage) {
    return {
      type: 'audio',
      text: 'Pesan Suara WhatsApp',
      mediaUrl: content.audioMessage.url || '',
    };
  }
  if (content.stickerMessage) {
    return {
      type: 'sticker',
      text: 'Stiker WhatsApp',
      mediaUrl: content.stickerMessage.url || '',
    };
  }
  return { type: 'text', text: 'Pesan WhatsApp' };
}

export function getBaileysStatus(): BaileysState {
  return getState();
}

export function setLinkedUserId(userId: string) {
  const state = getState();
  state.linkedUserId = userId;
}

export async function disconnectBaileys(): Promise<void> {
  const state = getState();
  if (global.__baileysSocket) {
    try {
      await global.__baileysSocket.logout();
    } catch {
      try {
        global.__baileysSocket.end(undefined);
      } catch {}
    }
    global.__baileysSocket = null;
  }

  // Clear credentials
  try {
    const authDir = getAuthFolder();
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
  } catch {}

  state.status = 'disconnected';
  state.qrCode = null;
  state.pairingCode = null;
  state.user = null;
  state.lastError = null;
  state.connectedAt = null;
}

export async function connectBaileys(options?: {
  userId?: string;
  phoneForPairing?: string;
  forceRestart?: boolean;
}): Promise<BaileysState> {
  const state = getState();

  if (options?.userId) {
    state.linkedUserId = options.userId;
  }

  // If already connected and not forcing restart, return current state
  if (global.__baileysSocket && state.status === 'connected' && !options?.forceRestart) {
    return state;
  }

  // If connecting currently and not forcing restart, return current state
  if (
    global.__baileysSocket &&
    (state.status === 'connecting' || state.status === 'qrcode') &&
    !options?.forceRestart &&
    !options?.phoneForPairing
  ) {
    return state;
  }

  // Clean old socket if exists
  if (global.__baileysSocket) {
    try {
      global.__baileysSocket.end(undefined);
    } catch {}
    global.__baileysSocket = null;
  }

  state.status = 'connecting';
  state.lastError = null;

  try {
    const authDir = getAuthFolder();
    const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);

    const logger = pino({ level: 'silent' });

    const { version } = await fetchLatestBaileysVersion().catch(() => ({
      version: [2, 3000, 1043857760] as [number, number, number],
    }));

    const sock = makeWASocket({
      version,
      auth: authState,
      logger,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      defaultQueryTimeoutMs: 90000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      qrTimeout: 60000,
    });

    global.__baileysSocket = sock;

    // Save auth credentials whenever updated safely
    sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
      } catch (err: any) {
        console.warn('saveCreds error:', err?.message);
      }
    });

    let pairingRequested = false;

    // Connection events
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Request pairing code safely when socket is open and ready
      if (
        options?.phoneForPairing &&
        !pairingRequested &&
        !sock.authState.creds.registered &&
        (qr || connection === 'open')
      ) {
        pairingRequested = true;
        try {
          const cleanPhone = options.phoneForPairing.replace(/[^0-9]/g, '');
          const code = await sock.requestPairingCode(cleanPhone);
          state.pairingCode = code;
          state.qrCode = null;
          state.status = 'pairing';
          baileysEvents.emit('event', { type: 'pairing', pairingCode: code });
        } catch (pairErr: any) {
          state.lastError = 'Gagal request pairing code: ' + (pairErr?.message || pairErr);
          baileysEvents.emit('event', { type: 'error', error: state.lastError });
        }
      }

      if (qr && !options?.phoneForPairing && state.status !== 'pairing') {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
          state.qrCode = qrDataUrl;
          state.status = 'qrcode';
          baileysEvents.emit('event', { type: 'qr', qrCode: qrDataUrl });
        } catch (err: any) {
          state.lastError = 'Gagal generate QR Code: ' + err?.message;
          baileysEvents.emit('event', { type: 'error', error: state.lastError });
        }
      }

      if (connection === 'open') {
        state.status = 'connected';
        state.qrCode = null;
        state.pairingCode = null;
        state.connectedAt = new Date().toISOString();

        if (sock.user) {
          const rawId = sock.user.id || '';
          const phone = rawId.split(':')[0].replace('@s.whatsapp.net', '');
          const name = sock.user.name || ('+' + phone);

          let avatar: string | undefined;
          let about: string | undefined;

          try {
            avatar = (await sock.profilePictureUrl(sock.user.id, 'image')) || undefined;
          } catch {}

          try {
            const statusObj: any = await sock.fetchStatus(sock.user.id);
            about =
              typeof statusObj?.status === 'string'
                ? statusObj.status
                : Array.isArray(statusObj) && statusObj[0]?.status
                ? statusObj[0].status
                : undefined;
          } catch {}

          state.user = {
            id: rawId,
            phone,
            name,
            avatar,
            about,
          };

          baileysEvents.emit('event', { type: 'connected', user: state.user });

          // Auto-sync into user account if linkedUserId is set
          if (state.linkedUserId) {
            try {
              await syncUserProfileToDb(state.linkedUserId);
            } catch (syncErr) {
              console.warn('Auto profile sync failed:', syncErr);
            }
          }
        }
      }

      if (connection === 'close') {
        const error = lastDisconnect?.error as any;
        const statusCode = error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        // Clean current socket reference so next connect creates fresh socket
        if (global.__baileysSocket) {
          try {
            global.__baileysSocket.end(undefined);
          } catch {}
          global.__baileysSocket = null;
        }

        if (statusCode === DisconnectReason.loggedOut) {
          state.status = 'disconnected';
          state.user = null;
          state.qrCode = null;
          state.pairingCode = null;
          state.lastError = 'Sesi WhatsApp telah logout dari ponsel.';
          baileysEvents.emit('event', { type: 'disconnected', error: state.lastError });

          // Clear credentials folder on explicit logout
          try {
            const authDir = getAuthFolder();
            if (fs.existsSync(authDir)) {
              fs.rmSync(authDir, { recursive: true, force: true });
            }
          } catch {}
        } else if (shouldReconnect) {
          // If restart required (code 515), reconnect IMMEDIATELY (200ms) so WhatsApp registration handshake completes!
          // Otherwise wait 3s before retry.
          const reconnectDelay = statusCode === DisconnectReason.restartRequired ? 200 : 3000;
          state.status = 'connecting';
          baileysEvents.emit('event', { type: 'status', status: 'connecting' });
          setTimeout(() => {
            if (state.status !== 'disconnected' && state.status !== 'connected') {
              connectBaileys({ userId: state.linkedUserId || undefined, forceRestart: true });
            }
          }, reconnectDelay);
        } else {
          state.status = 'error';
          state.lastError = error?.message || 'Koneksi WhatsApp terputus.';
          baileysEvents.emit('event', { type: 'error', error: state.lastError });
        }
      }
    });


    // Listen to incoming messages and sync into db
    sock.ev.on('messages.upsert', async ({ messages: newMsgs }) => {
      const targetUserId = state.linkedUserId;
      if (!targetUserId) return;

      const db = await readDb();

      for (const msg of newMsgs) {
        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') continue;

        const isGroup = remoteJid.endsWith('@g.us');
        const fromMe = Boolean(msg.key?.fromMe);
        const { text, type, mediaUrl } = extractMessageContent(msg);

        // Deduplication
        const msgId = `wa_${msg.key.id}`;
        if (db.messages.some((m) => m.id === msgId)) continue;

        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}`;

        if (!isGroup) {
          // Direct 1-on-1 WhatsApp Chat
          const phone = remoteJid.replace('@s.whatsapp.net', '');
          const waContactId = `wa_${phone}`;

          // Create or update contact user in db
          const existingContact = db.users.find((u) => u.id === waContactId);
          if (!existingContact) {
            db.users.push({
              id: waContactId,
              username: `wa_${phone}`,
              name: msg.pushName || `+${phone}`,
              phone,
              avatar:
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
              about: 'Kontak WhatsApp Asli',
              isOnline: true,
              friends: [targetUserId],
            });
            await writeDb(db);
          }

          const saved: Message = {
            id: msgId,
            chatId: getChatRoomId(targetUserId, waContactId),
            senderId: fromMe ? targetUserId : waContactId,
            recipientId: fromMe ? waContactId : targetUserId,
            senderName: fromMe ? 'Saya' : msg.pushName || `+${phone}`,
            type,
            text,
            mediaUrl,
            timestamp: timeString,
            status: 'read',
          };

          await saveMessage(saved);
        } else {
          // Group Chat
          const groupId = `grp_wa_${remoteJid.replace('@g.us', '')}`;
          let group = (db.groups || []).find((g) => g.id === groupId);

          if (!group) {
            if (!db.groups) db.groups = [];
            group = {
              id: groupId,
              name: `Grup WhatsApp (${remoteJid.substring(0, 8)})`,
              description: 'Sinkronisasi dari Grup WhatsApp Asli',
              avatar:
                'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
              createdBy: targetUserId,
              admins: [targetUserId],
              members: [targetUserId],
              createdAt: new Date().toISOString(),
            };
            db.groups.push(group);
            await writeDb(db);
          }

          const participantJid = msg.key?.participant || msg.participant || '';
          const partPhone = participantJid.replace('@s.whatsapp.net', '');
          const senderId = fromMe ? targetUserId : `wa_${partPhone || 'anon'}`;

          const saved: Message = {
            id: msgId,
            chatId: groupId,
            senderId,
            recipientId: groupId,
            senderName: fromMe ? 'Saya' : msg.pushName || `+${partPhone}`,
            type,
            text,
            mediaUrl,
            timestamp: timeString,
            status: 'read',
          };

          await saveMessage(saved);
        }
      }
    });

    // If waiting for pairing code, wait for it to be generated before returning HTTP response
    if (options?.phoneForPairing && !sock.authState.creds.registered) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 8000);
        const interval = setInterval(() => {
          if (state.pairingCode || state.status === 'connected' || state.status === 'error') {
            clearInterval(interval);
            clearTimeout(timeout);
            resolve();
          }
        }, 200);
      });
    }

    return state;
  } catch (err: any) {
    state.status = 'error';
    state.lastError = err?.message || 'Gagal menginisialisasi Baileys';
    return state;
  }
}

// Sync real WhatsApp account info directly into current user profile in DB
export async function syncUserProfileToDb(userId: string): Promise<UserAccount | null> {
  const state = getState();
  if (!state.user) {
    throw new Error('Belum ada akun WhatsApp yang terhubung.');
  }

  const updates: { name?: string; avatar?: string; about?: string } = {};
  if (state.user.name) updates.name = state.user.name;
  if (state.user.avatar) updates.avatar = state.user.avatar;
  if (state.user.about) updates.about = state.user.about;

  const updatedUser = await updateUserProfile(userId, updates);

  // Also ensure phone field is recorded
  if (updatedUser && state.user.phone) {
    const db = await readDb();
    const idx = db.users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      db.users[idx].phone = state.user.phone;
      await writeDb(db);
    }
  }

  return updatedUser;
}

// Send outgoing WhatsApp message through Baileys
export async function sendWhatsAppMessage(toPhoneOrJid: string, text: string): Promise<boolean> {
  if (!global.__baileysSocket) {
    throw new Error('Baileys tidak aktif atau belum terhubung.');
  }

  let jid = toPhoneOrJid;
  if (!jid.includes('@')) {
    const clean = toPhoneOrJid.replace(/[^0-9]/g, '');
    jid = `${clean}@s.whatsapp.net`;
  }

  await global.__baileysSocket.sendMessage(jid, { text });
  return true;
}
