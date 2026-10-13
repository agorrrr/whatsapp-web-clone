import fs from 'fs';
import path from 'path';
import { UserAccount, Message } from '../types/chat';

// Pre-seeded users for demo & immediate testing
const SEED_USERS: UserAccount[] = [
  {
    id: 'usr_budi',
    username: 'budi',
    name: 'Budi Santoso',
    identifier: 'budi@gmail.com',
    identifierType: 'email',
    pin: '123456',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    about: 'Sibuk kerja, chat penting aja ya.',
    isOnline: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_siti',
    username: 'siti',
    name: 'Siti Rahma',
    identifier: '+6282199887766',
    identifierType: 'phone',
    pin: '123456',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    about: 'Living my best life ✨',
    isOnline: false,
    lastSeen: 'hari ini pukul 10:15',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_bot',
    username: 'bot',
    name: 'WhatsApp Bot Assistant 🤖',
    identifier: 'bot@whatsapp.id',
    identifierType: 'email',
    pin: '123456',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    about: 'Asisten AI otomatis siap merespon pesanmu',
    isOnline: true,
    createdAt: new Date().toISOString(),
  },
];

interface DatabaseSchema {
  users: UserAccount[];
  messages: Message[];
}

// In-memory fallback for serverless execution
let memoryDb: DatabaseSchema = {
  users: [...SEED_USERS],
  messages: [],
};

function getDbFilePath(): string {
  // Use /tmp on Vercel / serverless if data folder is not writable
  try {
    const localDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return path.join(localDir, 'database.json');
  } catch {
    return path.join('/tmp', 'wa_database.json');
  }
}

export function readDb(): DatabaseSchema {
  try {
    const filePath = getDbFilePath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      // Ensure seed users exist
      const existingUserIds = new Set(parsed.users.map((u: UserAccount) => u.id));
      for (const su of SEED_USERS) {
        if (!existingUserIds.has(su.id)) {
          parsed.users.push(su);
        }
      }
      memoryDb = parsed;
      return parsed;
    }
  } catch (err) {
    console.warn('File DB read failed, using memory fallback:', err);
  }
  return memoryDb;
}

export function writeDb(db: DatabaseSchema): void {
  memoryDb = db;
  try {
    const filePath = getDbFilePath();
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.warn('File DB write failed, using memory fallback:', err);
  }
}

// User methods
export function findUserByIdentifier(identifier: string): UserAccount | undefined {
  const db = readDb();
  const clean = identifier.trim().toLowerCase();
  return db.users.find(
    (u) =>
      u.identifier.toLowerCase() === clean ||
      u.username.toLowerCase() === clean.replace(/^@/, '')
  );
}

export function findUserByUsername(username: string): UserAccount | undefined {
  const db = readDb();
  const clean = username.trim().toLowerCase().replace(/^@/, '');
  return db.users.find((u) => u.username.toLowerCase() === clean);
}

export function findUserById(id: string): UserAccount | undefined {
  const db = readDb();
  return db.users.find((u) => u.id === id);
}

export function createUser(user: UserAccount): UserAccount {
  const db = readDb();
  db.users.push(user);
  writeDb(db);
  return user;
}

export function getAllUsers(): UserAccount[] {
  const db = readDb();
  return db.users;
}

// Message methods
export function getChatRoomId(userA: string, userB: string): string {
  return [userA, userB].sort().join('__');
}

export function saveMessage(msg: Message): Message {
  const db = readDb();
  db.messages.push(msg);
  writeDb(db);
  return msg;
}

export function getMessagesBetween(userA: string, userB: string): Message[] {
  const db = readDb();
  const roomId = getChatRoomId(userA, userB);
  return db.messages.filter((m) => m.chatId === roomId);
}

export function getMessagesForUser(userId: string): Message[] {
  const db = readDb();
  return db.messages.filter((m) => m.recipientId === userId || m.senderId === userId);
}
