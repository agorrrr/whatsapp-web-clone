/**
 * Standalone Baileys WhatsApp Gateway Runner
 * Keeps WhatsApp connection alive 24/7 in background.
 * Syncs messages directly into the cloud Gist database.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');

const PORT = process.env.PORT || 3001;
const GIST_ID = process.env.GIST_ID || '9d6bf54cf48dffbca905eff3a3a4fa45';
const GITHUB_TOKEN =
  process.env.DATABASE_TOKEN ||
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN;

let qrCodeDataUrl = null;
let pairingCode = null;
let connectionStatus = 'idle';
let connectedUser = null;
let sock = null;

function getAuthFolder() {
  const dir = path.join(process.cwd(), 'data', 'baileys_gateway_auth');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Fetch database from Gist
async function readDb() {
  if (GITHUB_TOKEN && GIST_ID) {
    try {
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Ini-Bukan-Whatsapp-Gateway',
        },
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.files?.['database.json']?.content;
        if (content) return JSON.parse(content);
      }
    } catch (err) {
      console.warn('[Gateway] Gist read failed:', err.message);
    }
  }

  // Fallback
  const fallbackPath = path.join(process.cwd(), 'data', 'database.json');
  if (fs.existsSync(fallbackPath)) {
    return JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
  }
  return { users: [], messages: [], groups: [] };
}

// Write database to Gist
async function writeDb(db) {
  if (GITHUB_TOKEN && GIST_ID) {
    try {
      await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Ini-Bukan-Whatsapp-Gateway',
        },
        body: JSON.stringify({
          files: {
            'database.json': {
              content: JSON.stringify(db),
            },
          },
        }),
      });
    } catch (err) {
      console.warn('[Gateway] Gist write failed:', err.message);
    }
  }

  const fallbackPath = path.join(process.cwd(), 'data', 'database.json');
  try {
    fs.writeFileSync(fallbackPath, JSON.stringify(db, null, 2), 'utf-8');
  } catch {}
}

async function startBaileys(phoneForPairing = null) {
  connectionStatus = 'connecting';
  const authDir = getAuthFolder();
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: ['Ini Bukan Whatsapp Gateway', 'Chrome', '1.0.0'],
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
      connectionStatus = 'qrcode';
      console.log('[Gateway] New QR Code generated. Scan with WhatsApp!');
    }

    if (connection === 'open') {
      connectionStatus = 'connected';
      qrCodeDataUrl = null;
      pairingCode = null;
      console.log('[Gateway] WhatsApp Connected as:', sock.user?.id);

      if (sock.user) {
        const rawId = sock.user.id;
        const phone = rawId.split(':')[0].replace('@s.whatsapp.net', '');
        connectedUser = {
          id: rawId,
          phone,
          name: sock.user.name || `+${phone}`,
        };
      }
    }

    if (connection === 'close') {
      const error = lastDisconnect?.error;
      const statusCode = error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (statusCode === DisconnectReason.loggedOut) {
        connectionStatus = 'disconnected';
        connectedUser = null;
        console.log('[Gateway] Logged out from WhatsApp');
      } else if (shouldReconnect) {
        console.log('[Gateway] Connection closed, reconnecting in 5s...');
        setTimeout(() => startBaileys(), 5000);
      }
    }
  });

  if (phoneForPairing && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const clean = phoneForPairing.replace(/[^0-9]/g, '');
        pairingCode = await sock.requestPairingCode(clean);
        connectionStatus = 'pairing';
        console.log('[Gateway] Pairing Code:', pairingCode);
      } catch (err) {
        console.error('[Gateway] Pairing code failed:', err.message);
      }
    }, 2000);
  }

  // Handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      const remoteJid = msg.key?.remoteJid;
      if (!remoteJid || remoteJid === 'status@broadcast') continue;

      const fromMe = Boolean(msg.key?.fromMe);
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        (msg.message?.audioMessage ? 'Pesan Suara' : 'Pesan WhatsApp');

      const isGroup = remoteJid.endsWith('@g.us');
      const now = new Date();
      const timeString = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;

      const db = await readDb();
      const msgId = `wa_${msg.key.id}`;
      if (db.messages.some((m) => m.id === msgId)) continue;

      // Find first registered user as recipient if not from me
      const defaultUser = db.users[0];
      const targetUserId = defaultUser?.id || 'usr_default';

      if (!isGroup) {
        const phone = remoteJid.replace('@s.whatsapp.net', '');
        const waContactId = `wa_${phone}`;

        let contact = db.users.find((u) => u.id === waContactId);
        if (!contact) {
          contact = {
            id: waContactId,
            username: `wa_${phone}`,
            name: msg.pushName || `+${phone}`,
            phone,
            avatar:
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            about: 'Kontak WhatsApp Asli',
            isOnline: true,
          };
          db.users.push(contact);
        }

        db.messages.push({
          id: msgId,
          chatId: [targetUserId, waContactId].sort().join('__'),
          senderId: fromMe ? targetUserId : waContactId,
          recipientId: fromMe ? waContactId : targetUserId,
          senderName: fromMe ? 'Saya' : msg.pushName || `+${phone}`,
          type: 'text',
          text,
          timestamp: timeString,
          status: 'read',
        });

        await writeDb(db);
        console.log(`[Gateway] Synced WA msg from +${phone}: "${text.slice(0, 30)}"`);
      }
    }
  });
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/status' || url.pathname === '/api/baileys') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        success: true,
        status: connectionStatus,
        qrCode: qrCodeDataUrl,
        pairingCode,
        user: connectedUser,
      })
    );
  }

  if (url.pathname === '/connect' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      let parsed = {};
      try {
        parsed = JSON.parse(body);
      } catch {}
      await startBaileys(parsed.phone);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, status: connectionStatus }));
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[Gateway] WhatsApp Baileys Gateway running on port ${PORT}`);
  startBaileys();
});
