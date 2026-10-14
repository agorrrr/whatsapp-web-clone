import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import os from 'os';
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

    const sock = makeWASocket({
      auth: authState,
      logger,
      printQRInTerminal: false,
      browser: ['Ini Bukan Whatsapp', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      generateHighQualityLinkPreview: true,
      defaultQueryTimeoutMs: 60000,
    });

    global.__baileysSocket = sock;

    // Save auth credentials whenever updated
    sock.ev.on('creds.update', saveCreds);

    // Connection events
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
          state.qrCode = qrDataUrl;
          state.status = 'qrcode';
        } catch (err: any) {
          state.lastError = 'Gagal generate QR Code: ' + err?.message;
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

        if (statusCode === DisconnectReason.loggedOut) {
          state.status = 'disconnected';
          state.user = null;
          state.qrCode = null;
          state.pairingCode = null;
          state.lastError = 'Sesi WhatsApp telah logout dari ponsel.';
          global.__baileysSocket = null;
        } else if (shouldReconnect) {
          state.status = 'connecting';
          // Auto reconnect after short delay
          setTimeout(() => {
            if (state.status !== 'disconnected') {
              connectBaileys({ userId: state.linkedUserId || undefined });
            }
          }, 3000);
        } else {
          state.status = 'error';
          state.lastError = error?.message || 'Koneksi WhatsApp terputus.';
        }
      }
    });

    // Handle pairing code if requested
    if (options?.phoneForPairing && !sock.authState.creds.registered) {
      const cleanPhone = options.phoneForPairing.replace(/[^0-9]/g, '');
      if (cleanPhone) {
        setTimeout(async () => {
          try {
            const code = await sock.requestPairingCode(cleanPhone);
            state.pairingCode = code;
            state.status = 'pairing';
          } catch (pairErr: any) {
            state.lastError = 'Gagal request pairing code: ' + (pairErr?.message || pairErr);
          }
        }, 1500);
      }
    }

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
