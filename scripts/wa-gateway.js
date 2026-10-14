/**
 * Standalone Baileys WhatsApp Gateway Runner
 * Keeps WhatsApp connection alive 24/7 on local computer.
 * Syncs messages and profile directly into cloud Gist database.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');

// Load .env.local if present
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim().replace(/(^"|"$)/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

const PORT = process.env.PORT || 3001;
const GIST_ID = process.env.GIST_ID || '9d6bf54cf48dffbca905eff3a3a4fa45';
const GITHUB_TOKEN =
  process.env.DATABASE_TOKEN ||
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN;

let qrCodeDataUrl = null;
let currentPairingCode = null;
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

async function startBaileys() {
  connectionStatus = 'connecting';
  const authDir = getAuthFolder();
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const { version } = await fetchLatestBaileysVersion().catch(() => ({
    version: [2, 3000, 1043857760],
  }));

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    qrTimeout: 60000,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
      connectionStatus = 'qrcode';
      console.log('\n[Gateway] ==========================================');
      console.log('[Gateway] QR CODE BARU TERSEDIA. Buka http://localhost:3001');
      console.log('[Gateway] ==========================================\n');
    }

    if (connection === 'open') {
      connectionStatus = 'connected';
      qrCodeDataUrl = null;
      currentPairingCode = null;

      if (sock.user) {
        const rawId = sock.user.id || '';
        const phone = rawId.split(':')[0].replace('@s.whatsapp.net', '');
        const name = sock.user.name || `+${phone}`;

        let avatar = undefined;
        let about = undefined;
        try {
          avatar = await sock.profilePictureUrl(sock.user.id, 'image');
        } catch {}
        try {
          const st = await sock.fetchStatus(sock.user.id);
          about = st?.status;
        } catch {}

        connectedUser = {
          id: rawId,
          phone,
          name,
          avatar,
          about,
        };

        console.log(`\n[Gateway] ✅ WHATSAPP BERHASIL TERHUBUNG: ${name} (+${phone})`);

        // Auto-sync into first user or ezakasep in Gist DB
        try {
          const db = await readDb();
          const targetUser = db.users.find((u) => u.username === 'ezakasep') || db.users[0];
          if (targetUser) {
            targetUser.phone = phone;
            if (name) targetUser.name = name;
            if (avatar) targetUser.avatar = avatar;
            if (about) targetUser.about = about;
            await writeDb(db);
            console.log(`[Gateway] ✅ Profil akun web ${targetUser.username} otomatis diperbarui.`);
          }
        } catch (dbErr) {
          console.warn('[Gateway] Auto db sync error:', dbErr.message);
        }
      }
    }

    if (connection === 'close') {
      const error = lastDisconnect?.error;
      const statusCode = error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (sock) {
        try { sock.end(undefined); } catch {}
        sock = null;
      }

      if (statusCode === DisconnectReason.loggedOut) {
        connectionStatus = 'disconnected';
        connectedUser = null;
        qrCodeDataUrl = null;
        currentPairingCode = null;
        console.log('[Gateway] Sesi WhatsApp logout dari ponsel. Bersihkan auth lama dan mulai sesi baru...');
        try {
          const authDir = getAuthFolder();
          if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
        } catch {}
        setTimeout(() => startBaileys(), 1500);
      } else if (shouldReconnect) {
        const delay = statusCode === DisconnectReason.restartRequired ? 200 : 3000;
        console.log(`[Gateway] Koneksi terputus (status ${statusCode}), reconnecting dalam ${delay}ms...`);
        setTimeout(() => startBaileys(), delay);
      }
    }
  });

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

      const targetUser = db.users.find((u) => u.username === 'ezakasep') || db.users[0];
      const targetUserId = targetUser?.id || 'usr_default';

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
          sentToRealWa: true,
        });

        await writeDb(db);
        console.log(`[Gateway] Synced WA msg from +${phone}: "${text.slice(0, 30)}"`);
      }
    }
  });
}

// Request pairing code on active socket
async function requestPairing(phone) {
  if (!sock) {
    throw new Error('Socket belum siap');
  }
  const clean = phone.replace(/[^0-9]/g, '');
  if (!clean || clean.length < 8) {
    throw new Error('Nomor telepon tidak valid');
  }

  // Ensure socket is not still connecting
  if (connectionStatus === 'connecting') {
    await new Promise((resolve) => {
      const t = setTimeout(resolve, 6000);
      const int = setInterval(() => {
        if (connectionStatus !== 'connecting') {
          clearInterval(int);
          clearTimeout(t);
          resolve();
        }
      }, 200);
    });
  }

  const code = await sock.requestPairingCode(clean);
  currentPairingCode = code;
  qrCodeDataUrl = null;
  connectionStatus = 'pairing';
  console.log(`[Gateway] ✅ KODE PAIRING UNTUK +${clean}: ${code}`);
  return code;
}

// Send outgoing WhatsApp message
async function sendWaMessage(toJidOrPhone, text) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp Gateway belum terhubung');
  }

  let jid = toJidOrPhone.replace(/^wa_/, '');
  if (!jid.includes('@')) {
    const clean = jid.replace(/[^0-9]/g, '');
    jid = `${clean}@s.whatsapp.net`;
  }

  const sent = await sock.sendMessage(jid, { text });
  console.log(`[Gateway] 🚀 Pesan WhatsApp berhasil dikirim ke ${jid}: "${text}"`);
  return sent;
}

// Watch Gist / local database for any outgoing replies sent from web app (Vercel or local)
let isCheckingQueue = false;
async function checkOutgoingQueue() {
  if (isCheckingQueue || !sock || connectionStatus !== 'connected') return;
  isCheckingQueue = true;

  try {
    const db = await readDb();
    const targetUser = db.users.find((u) => u.username === 'ezakasep') || db.users[0];
    const targetUserId = targetUser?.id;

    let hasUpdates = false;

    for (const msg of db.messages) {
      if (
        msg.senderId === targetUserId &&
        msg.recipientId &&
        msg.recipientId.startsWith('wa_') &&
        !msg.sentToRealWa
      ) {
        try {
          await sendWaMessage(msg.recipientId, msg.text || '');
          msg.sentToRealWa = true;
          msg.status = 'sent';
          hasUpdates = true;
        } catch (err) {
          console.error(`[Gateway] Gagal kirim pesan ke ${msg.recipientId}:`, err.message);
        }
      }
    }

    if (hasUpdates) {
      await writeDb(db);
      console.log('[Gateway] ✅ Status pesan terkirim diperbarui di database.');
    }
  } catch (err) {
    // ignore
  } finally {
    isCheckingQueue = false;
  }
}

// Check outgoing queue every 1.5 seconds
setInterval(checkOutgoingQueue, 1500);

// HTML Dashboard for easy browser connection
function renderHtml() {
  const isConn = connectionStatus === 'connected' && connectedUser;
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ini Bukan Whatsapp - Local Gateway</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #111b21; color: #e9edef; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #202c33; width: 100%; max-width: 480px; border-radius: 16px; padding: 24px; border: 1px solid #2a3942; box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; }
    h1 { font-size: 1.25rem; margin-top: 0; color: #00a884; }
    p { font-size: 0.85rem; color: #8696a0; margin: 8px 0 16px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; margin-bottom: 16px; }
    .status-connected { background: rgba(37,211,102,0.15); color: #25d366; border: 1px solid rgba(37,211,102,0.3); }
    .status-wait { background: rgba(0,168,132,0.15); color: #00a884; border: 1px solid rgba(0,168,132,0.3); }
    .qr-box { background: white; padding: 12px; border-radius: 12px; display: inline-block; margin: 12px auto; }
    .qr-box img { width: 220px; height: 220px; display: block; }
    .code-box { font-size: 2rem; font-family: monospace; font-weight: bold; letter-spacing: 4px; color: #25d366; background: #111b21; padding: 12px; border-radius: 8px; border: 1px solid #00a884; margin: 16px 0; }
    .form-group { margin: 16px 0; text-align: left; }
    label { font-size: 0.75rem; font-weight: bold; color: #00a884; display: block; margin-bottom: 6px; }
    input { width: 100%; background: #111b21; border: 1px solid #2a3942; padding: 10px 14px; border-radius: 8px; color: #e9edef; font-size: 0.9rem; font-family: monospace; box-sizing: border-box; outline: none; }
    button { width: 100%; background: #00a884; color: white; border: none; padding: 12px; border-radius: 8px; font-size: 0.85rem; font-weight: bold; cursor: pointer; transition: 0.2s; margin-top: 8px; }
    button:hover { background: #008f70; }
    .links { margin-top: 20px; font-size: 0.75rem; }
    .links a { color: #00a884; text-decoration: none; font-weight: bold; }
    ol { text-align: left; font-size: 0.75rem; color: #8696a0; padding-left: 20px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>WhatsApp Gateway 24/7</h1>
    <p>Baileys Background Runner (Koneksi Stabil Tanpa Timeout)</p>

    ${
      isConn
        ? `<div class="status-badge status-connected">● Terhubung ke WhatsApp</div>
           <div style="margin: 16px 0;">
             <div style="font-size: 1.1rem; font-weight: bold;">${connectedUser.name}</div>
             <div style="color: #8696a0; font-family: monospace;">+${connectedUser.phone}</div>
           </div>
           <p style="color: #25d366;">Koneksi aktif! Semua pesan WhatsApp akan tersinkron otomatis ke web app Anda.</p>
           <button onclick="location.reload()">Refresh Status</button>`
        : `<div class="status-badge status-wait">● Menunggu Scan / Pairing Code</div>

           ${
             currentPairingCode
               ? `<div style="font-size: 0.8rem; color: #8696a0;">MASUKKAN KODE INI DI WHATSAPP PONSEL:</div>
                  <div class="code-box">${currentPairingCode}</div>
                  <p>Buka WhatsApp di HP &gt; Perangkat Tertaut &gt; Tautkan dengan nomor telepon saja.</p>`
               : qrCodeDataUrl
               ? `<div class="qr-box"><img src="${qrCodeDataUrl}" alt="QR Code"></div>
                  <p>Arahkan kamera WhatsApp HP ke QR Code di atas.</p>`
               : `<div style="padding: 30px; color: #8696a0;">Menyiapkan socket WhatsApp...</div>`
           }

           <form method="POST" action="/pair" class="form-group">
             <label>Nomor Telepon WhatsApp untuk Kode Pairing:</label>
             <input type="tel" name="phone" placeholder="6285183355325" value="6285183355325" required>
             <button type="submit">Dapatkan Kode Pairing (8 Digit)</button>
           </form>

           <ol>
             <li>Ketik nomor WhatsApp di atas lalu klik <b>Dapatkan Kode Pairing</b></li>
             <li>Buka WhatsApp di HP &gt; Perangkat Tertaut &gt; Tautkan dengan nomor telepon</li>
             <li>Ketik 8 huruf/angka yang muncul di atas</li>
           </ol>`
    }

    <div class="links">
      Buka Web App: <a href="https://wacklone.vercel.app" target="_blank">wacklone.vercel.app</a>
    </div>
  </div>
  <script>
    // Auto reload status every 4 seconds
    setTimeout(() => location.reload(), 4000);
  </script>
</body>
</html>`;
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

  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderHtml());
  }

  if (url.pathname === '/status' || url.pathname === '/api/baileys') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        success: true,
        status: connectionStatus,
        qrCode: qrCodeDataUrl,
        pairingCode: currentPairingCode,
        user: connectedUser,
      })
    );
  }

  if (url.pathname === '/pair' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      let phone = '';
      if (body.includes('phone=')) {
        phone = decodeURIComponent(body.split('phone=')[1].split('&')[0]);
      } else {
        try {
          const parsed = JSON.parse(body);
          phone = parsed.phone;
        } catch {
          const match = body.match(/\d{8,15}/);
          if (match) phone = match[0];
        }
      }

      try {
        const code = await requestPairing(phone);
        if (req.headers['content-type']?.includes('application/json')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, pairingCode: code }));
        } else {
          // Redirect back to dashboard
          res.writeHead(302, { Location: '/' });
          return res.end();
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  if (url.pathname === '/send' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        const { to, text } = parsed;
        if (!to || !text) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'to dan text wajib ada' }));
        }

        const sent = await sendWaMessage(to, text);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, messageId: sent?.key?.id }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[Gateway] WhatsApp Baileys Gateway running on http://localhost:${PORT}`);
  startBaileys();
});
