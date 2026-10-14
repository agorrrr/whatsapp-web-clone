import fs from 'fs';
import path from 'path';
import { UserAccount, Message } from '../types/chat';

// Cloud Gist database configuration for persistent Vercel serverless execution
const GIST_ID = process.env.GIST_ID || '9d6bf54cf48dffbca905eff3a3a4fa45';
const GITHUB_TOKEN =
  process.env.DATABASE_TOKEN ||
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN;

interface DatabaseSchema {
  users: UserAccount[];
  messages: Message[];
}

let inMemoryCache: DatabaseSchema = {
  users: [],
  messages: [],
};
let lastFetchTime = 0;
const CACHE_TTL_MS = 1000; // 1 second cache

function getLocalFallbackPath(): string {
  try {
    const dir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'database.json');
  } catch {
    return path.join('/tmp', 'database.json');
  }
}

// Read from Gist or local cache
export async function readDb(): Promise<DatabaseSchema> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL_MS && inMemoryCache.users.length > 0) {
    return inMemoryCache;
  }

  // Fetch from Gist
  if (GITHUB_TOKEN && GIST_ID) {
    try {
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'WhatsApp-Clone-Backend',
        },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.files?.['database.json']?.content;
        if (content) {
          const parsed = JSON.parse(content);
          inMemoryCache = {
            users: Array.isArray(parsed.users) ? parsed.users : [],
            messages: Array.isArray(parsed.messages) ? parsed.messages : [],
          };
          lastFetchTime = now;
          return inMemoryCache;
        }
      }
    } catch (err) {
      console.warn('Gist fetch failed, using fallback:', err);
    }
  }

  // Fallback to local file
  try {
    const fp = getLocalFallbackPath();
    if (fs.existsSync(fp)) {
      const parsed = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      inMemoryCache = {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      };
      return inMemoryCache;
    }
  } catch {}

  return inMemoryCache;
}

// Write to Gist and local fallback
export async function writeDb(db: DatabaseSchema): Promise<void> {
  inMemoryCache = db;
  lastFetchTime = Date.now();

  // Save to local file
  try {
    const fp = getLocalFallbackPath();
    fs.writeFileSync(fp, JSON.stringify(db, null, 2), 'utf-8');
  } catch {}

  // Sync to Gist
  if (GITHUB_TOKEN && GIST_ID) {
    try {
      await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'WhatsApp-Clone-Backend',
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
      console.warn('Gist patch failed:', err);
    }
  }
}

// User methods
export async function findUserByIdentifier(identifier: string): Promise<UserAccount | undefined> {
  const db = await readDb();
  const clean = identifier.trim().toLowerCase();
  return db.users.find(
    (u) =>
      u.identifier?.toLowerCase() === clean ||
      u.username?.toLowerCase() === clean.replace(/^@/, '') ||
      u.phone?.toLowerCase() === clean
  );
}

export async function findUserByUsername(username: string): Promise<UserAccount | undefined> {
  const db = await readDb();
  const clean = username.trim().toLowerCase().replace(/^@/, '');
  return db.users.find((u) => u.username?.toLowerCase() === clean);
}

export async function findUserById(id: string): Promise<UserAccount | undefined> {
  const db = await readDb();
  return db.users.find((u) => u.id === id);
}

export async function createUser(user: UserAccount): Promise<UserAccount> {
  const db = await readDb();
  // Ensure not duplicate
  const exists = db.users.some(
    (u) => u.id === user.id || u.username?.toLowerCase() === user.username?.toLowerCase()
  );
  if (!exists) {
    db.users.push(user);
    await writeDb(db);
  }
  return user;
}

export async function updateUserProfile(
  userId: string,
  updates: { name?: string; avatar?: string; about?: string }
): Promise<UserAccount | null> {
  const db = await readDb();
  const index = db.users.findIndex((u) => u.id === userId);
  if (index === -1) return null;

  if (updates.name) db.users[index].name = updates.name.trim();
  if (updates.avatar) db.users[index].avatar = updates.avatar.trim();
  if (updates.about) db.users[index].about = updates.about.trim();

  await writeDb(db);
  return db.users[index];
}

export async function getAllUsers(): Promise<UserAccount[]> {
  const db = await readDb();
  return db.users;
}

export async function getUserFriends(userId: string): Promise<UserAccount[]> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user || !Array.isArray(user.friends)) return [];
  return db.users
    .filter((u) => user.friends!.includes(u.id))
    .map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      identifier: u.identifier,
      avatar: u.avatar,
      about: u.about,
      isOnline: u.isOnline ?? true,
      lastSeen: u.lastSeen,
    }));
}

export async function addFriend(
  userId: string,
  friendIdentifierOrId: string
): Promise<{ success: boolean; message?: string; friend?: UserAccount; friends?: UserAccount[] }> {
  const db = await readDb();
  const userIndex = db.users.findIndex((u) => u.id === userId);
  if (userIndex === -1) {
    return { success: false, message: 'Pengguna tidak ditemukan' };
  }

  const clean = friendIdentifierOrId.trim().toLowerCase().replace(/^@/, '');
  const friendIndex = db.users.findIndex(
    (u) =>
      u.id === friendIdentifierOrId ||
      u.username?.toLowerCase() === clean ||
      u.identifier?.toLowerCase() === clean
  );

  if (friendIndex === -1) {
    return { success: false, message: 'Teman dengan username tersebut tidak ditemukan' };
  }

  const friend = db.users[friendIndex];
  if (friend.id === userId) {
    return { success: false, message: 'Tidak dapat menambah diri sendiri sebagai teman' };
  }

  // Reciprocal friend addition
  if (!Array.isArray(db.users[userIndex].friends)) {
    db.users[userIndex].friends = [];
  }
  if (!db.users[userIndex].friends!.includes(friend.id)) {
    db.users[userIndex].friends!.push(friend.id);
  }

  if (!Array.isArray(db.users[friendIndex].friends)) {
    db.users[friendIndex].friends = [];
  }
  if (!db.users[friendIndex].friends!.includes(userId)) {
    db.users[friendIndex].friends!.push(userId);
  }

  await writeDb(db);

  const friends = await getUserFriends(userId);
  return {
    success: true,
    friend: {
      id: friend.id,
      username: friend.username,
      name: friend.name,
      identifier: friend.identifier,
      avatar: friend.avatar,
      about: friend.about,
      isOnline: friend.isOnline ?? true,
    },
    friends,
  };
}


// Message methods
export function getChatRoomId(userA: string, userB: string): string {
  return [userA, userB].sort().join('__');
}

export async function saveMessage(msg: Message): Promise<Message> {
  const db = await readDb();
  db.messages.push(msg);
  await writeDb(db);
  return msg;
}

export async function getMessagesBetween(userA: string, userB: string): Promise<Message[]> {
  const db = await readDb();
  const roomId = getChatRoomId(userA, userB);
  return db.messages.filter((m) => m.chatId === roomId);
}

export async function getMessagesForUser(userId: string): Promise<Message[]> {
  const db = await readDb();
  return db.messages.filter((m) => m.recipientId === userId || m.senderId === userId);
}
