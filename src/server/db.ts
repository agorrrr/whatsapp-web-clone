import fs from 'fs';
import path from 'path';
import { UserAccount, Message, GroupChat, GroupMember, CallSession } from '../types/chat';

// Cloud Gist database configuration for persistent Vercel serverless execution
const GIST_ID = process.env.GIST_ID || '9d6bf54cf48dffbca905eff3a3a4fa45';
const GITHUB_TOKEN =
  process.env.DATABASE_TOKEN ||
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN;

interface DatabaseSchema {
  users: UserAccount[];
  messages: Message[];
  groups?: GroupChat[];
  activeCalls?: CallSession[];
}

let inMemoryCache: DatabaseSchema = {
  users: [],
  messages: [],
  groups: [],
  activeCalls: [],
};
let lastFetchTime = 0;
const CACHE_TTL_MS = 2500;
let activeFetchPromise: Promise<DatabaseSchema> | null = null;

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

  if (activeFetchPromise) {
    return activeFetchPromise;
  }

  activeFetchPromise = (async () => {
    try {
      // Fetch from Gist
      if (GITHUB_TOKEN && GIST_ID) {
        try {
          const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            headers: {
              Authorization: `token ${GITHUB_TOKEN}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'Ini-Bukan-Whatsapp-Backend',
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
                groups: Array.isArray(parsed.groups) ? parsed.groups : [],
                activeCalls: Array.isArray(parsed.activeCalls) ? parsed.activeCalls : [],
              };
              lastFetchTime = Date.now();
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
            groups: Array.isArray(parsed.groups) ? parsed.groups : [],
            activeCalls: Array.isArray(parsed.activeCalls) ? parsed.activeCalls : [],
          };
          return inMemoryCache;
        }
      } catch {}

      return inMemoryCache;
    } finally {
      activeFetchPromise = null;
    }
  })();

  return activeFetchPromise;
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
          'User-Agent': 'Ini-Bukan-Whatsapp-Backend',
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
  if (userB.startsWith('grp_')) return userB;
  if (userA.startsWith('grp_')) return userA;
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
  const userGroupIds = (db.groups || []).filter((g) => g.members.includes(userId)).map((g) => g.id);
  return db.messages.filter((m) => m.recipientId === userId || m.senderId === userId || userGroupIds.includes(m.chatId));
}

// Group methods
export async function createGroup(data: {
  name: string;
  description?: string;
  avatar?: string;
  creatorId: string;
  memberIds: string[];
}): Promise<GroupChat> {
  const db = await readDb();
  if (!db.groups) db.groups = [];

  const uniqueMembers = Array.from(new Set([data.creatorId, ...data.memberIds]));
  const defaultAvatar =
    data.avatar ||
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80';

  const newGroup: GroupChat = {
    id: `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: data.name.trim(),
    description: data.description?.trim() || 'Grup chat Ini Bukan Whatsapp',
    avatar: defaultAvatar,
    createdBy: data.creatorId,
    admins: [data.creatorId],
    members: uniqueMembers,
    createdAt: new Date().toISOString(),
  };

  db.groups.push(newGroup);
  await writeDb(db);
  return newGroup;
}

export async function getGroupById(groupId: string): Promise<GroupChat | null> {
  const db = await readDb();
  return (db.groups || []).find((g) => g.id === groupId) || null;
}

export async function getUserGroups(userId: string): Promise<GroupChat[]> {
  const db = await readDb();
  return (db.groups || []).filter((g) => g.members.includes(userId));
}

export async function updateGroupInfo(
  groupId: string,
  userId: string,
  updates: { name?: string; description?: string; avatar?: string }
): Promise<GroupChat | null> {
  const db = await readDb();
  const group = (db.groups || []).find((g) => g.id === groupId);
  if (!group) return null;
  if (!group.admins.includes(userId)) {
    throw new Error('Hanya admin grup yang dapat mengubah info grup');
  }

  if (updates.name) group.name = updates.name.trim();
  if (updates.description !== undefined) group.description = updates.description.trim();
  if (updates.avatar) group.avatar = updates.avatar.trim();
  group.updatedAt = new Date().toISOString();

  await writeDb(db);
  return group;
}

export async function addGroupMembers(
  groupId: string,
  userId: string,
  newMemberIds: string[]
): Promise<GroupChat | null> {
  const db = await readDb();
  const group = (db.groups || []).find((g) => g.id === groupId);
  if (!group) return null;
  if (!group.admins.includes(userId)) {
    throw new Error('Hanya admin grup yang dapat menambah anggota');
  }

  const set = new Set([...group.members, ...newMemberIds]);
  group.members = Array.from(set);
  group.updatedAt = new Date().toISOString();

  await writeDb(db);
  return group;
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
  targetMemberId: string
): Promise<GroupChat | null> {
  const db = await readDb();
  const group = (db.groups || []).find((g) => g.id === groupId);
  if (!group) return null;

  const isSelf = userId === targetMemberId;
  const isAdmin = group.admins.includes(userId);

  if (!isSelf && !isAdmin) {
    throw new Error('Hanya admin grup yang dapat mengeluarkan anggota');
  }

  group.members = group.members.filter((id) => id !== targetMemberId);
  group.admins = group.admins.filter((id) => id !== targetMemberId);

  if (group.admins.length === 0 && group.members.length > 0) {
    group.admins.push(group.members[0]);
  }

  group.updatedAt = new Date().toISOString();
  await writeDb(db);
  return group;
}

export async function toggleGroupAdmin(
  groupId: string,
  userId: string,
  targetMemberId: string
): Promise<GroupChat | null> {
  const db = await readDb();
  const group = (db.groups || []).find((g) => g.id === groupId);
  if (!group) return null;

  if (!group.admins.includes(userId)) {
    throw new Error('Hanya admin grup yang dapat mengubah status admin');
  }

  if (group.admins.includes(targetMemberId)) {
    if (group.admins.length === 1) {
      throw new Error('Grup harus memiliki minimal satu admin');
    }
    group.admins = group.admins.filter((id) => id !== targetMemberId);
  } else {
    group.admins.push(targetMemberId);
  }

  group.updatedAt = new Date().toISOString();
  await writeDb(db);
  return group;
}

export async function getGroupMembersDetails(groupId: string): Promise<GroupMember[]> {
  const db = await readDb();
  const group = (db.groups || []).find((g) => g.id === groupId);
  if (!group) return [];

  return group.members.map((memberId) => {
    const user = db.users.find((u) => u.id === memberId);
    return {
      id: memberId,
      name: user?.name || 'Pengguna',
      username: user?.username,
      avatar:
        user?.avatar ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      about: user?.about || 'Ada di Ini Bukan Whatsapp',
      isAdmin: group.admins.includes(memberId),
      isOnline: user?.isOnline ?? true,
    };
  });
}

