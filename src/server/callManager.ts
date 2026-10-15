import { CallSession, CallType, CallStatus, Message } from '../types/chat';
import { findUserById, getGroupById, saveMessage, getChatRoomId, readDb, writeDb } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __waActiveCalls: Map<string, CallSession> | undefined;
}

if (!global.__waActiveCalls) {
  global.__waActiveCalls = new Map<string, CallSession>();
}

const activeCalls = global.__waActiveCalls;

// Prune calls older than 2 minutes or unanswered ringing older than 40s
function pruneOldCalls() {
  const now = Date.now();
  activeCalls.forEach((call, id) => {
    const isRingingTimeout = call.status === 'ringing' && now - (call.startedAt || call.updatedAt) > 40000;
    if (now - call.updatedAt > 120000 || call.status === 'ended' || call.status === 'rejected' || isRingingTimeout) {
      if (now - call.updatedAt > 5000 || isRingingTimeout) {
        activeCalls.delete(id);
      }
    }
  });
}

export async function startCallSession({
  callerId,
  receiverId,
  type,
  sdpOffer,
}: {
  callerId: string;
  receiverId: string;
  type: CallType;
  sdpOffer?: string;
}): Promise<CallSession> {
  pruneOldCalls();

  if (callerId === receiverId) {
    throw new Error('Tidak dapat memanggil akun sendiri.');
  }

  const caller = await findUserById(callerId);
  const isGroup = receiverId.startsWith('grp_') || receiverId.includes('@g.us');
  let group = null;
  if (isGroup) {
    group = await getGroupById(receiverId);
    if (!group) throw new Error('Grup tidak ditemukan');
  }

  const receiver = !isGroup ? await findUserById(receiverId) : null;

  // Check if receiver is already in a 1-on-1 call
  if (!isGroup) {
    let isBusy = false;
    activeCalls.forEach((call) => {
      if (
        !call.isGroup &&
        (call.receiverId === receiverId || call.callerId === receiverId) &&
        (call.status === 'ringing' || call.status === 'connected')
      ) {
        isBusy = true;
      }
    });
    if (isBusy) {
      throw new Error('Pengguna sedang dalam panggilan lain (sibuk)');
    }
  }

  const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const defaultCallerAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

  const session: CallSession = {
    id: callId,
    callerId,
    callerName: caller?.name || 'Pengguna',
    callerAvatar: caller?.avatar || defaultCallerAvatar,
    receiverId,
    receiverName: isGroup ? group?.name || 'Grup' : receiver?.name || 'Pengguna',
    receiverAvatar: isGroup
      ? group?.avatar || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80'
      : receiver?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isGroup,
    groupId: isGroup ? receiverId : undefined,
    groupMembers: isGroup ? group?.members || [] : undefined,
    participants: [
      {
        id: callerId,
        name: caller?.name || 'Pengguna',
        avatar: caller?.avatar || defaultCallerAvatar,
        joinedAt: Date.now(),
      },
    ],
    type,
    status: 'ringing',
    sdpOffer,
    callerIce: [],
    receiverIce: [],
    updatedAt: Date.now(),
  };

  activeCalls.set(callId, session);

  try {
    const db = await readDb();
    if (!db.activeCalls) db.activeCalls = [];
    db.activeCalls = db.activeCalls.filter(
      (c) => Date.now() - c.updatedAt < 120000 && c.status !== 'ended' && c.status !== 'rejected'
    );
    db.activeCalls.push(session);
    await writeDb(db);
  } catch {}

  return session;
}

export async function getActiveCallForUser(userId: string): Promise<CallSession | null> {
  pruneOldCalls();
  const now = Date.now();
  let found: CallSession | null = null;
  activeCalls.forEach((call) => {
    if (!found) {
      const isDirect = call.callerId === userId || call.receiverId === userId;
      const isGroupMember = Boolean(
        call.isGroup && (call.groupMembers?.includes(userId) || call.invitedUsers?.includes(userId))
      );
      const isExpiredRinging =
        call.status === 'ringing' && now - (call.startedAt || call.updatedAt) > 40000;
      if (
        (isDirect || isGroupMember) &&
        (call.status === 'ringing' || call.status === 'connected') &&
        !isExpiredRinging
      ) {
        found = call;
      }
    }
  });
  if (found) return found;

  try {
    const db = await readDb();
    if (Array.isArray(db.activeCalls)) {
      const match = db.activeCalls.find(
        (c) =>
          (c.callerId === userId ||
            c.receiverId === userId ||
            (c.isGroup && (c.groupMembers?.includes(userId) || c.invitedUsers?.includes(userId)))) &&
          (c.status === 'ringing' || c.status === 'connected') &&
          now - c.updatedAt < 120000 &&
          !(c.status === 'ringing' && now - (c.startedAt || c.updatedAt) > 40000)
      );
      if (match) {
        activeCalls.set(match.id, match);
        return match;
      }
    }
  } catch {}

  return null;
}

export async function getCallById(callId: string): Promise<CallSession | null> {
  const inMem = activeCalls.get(callId);
  if (inMem) return inMem;

  try {
    const db = await readDb();
    const match = db.activeCalls?.find((c) => c.id === callId);
    if (match) {
      activeCalls.set(match.id, match);
      return match;
    }
  } catch {}

  return null;
}

export async function setCallOffer(callId: string, sdpOffer: string): Promise<CallSession> {
  let call = activeCalls.get(callId);
  if (!call) {
    try {
      const db = await readDb();
      call = db.activeCalls?.find((c) => c.id === callId);
    } catch {}
  }
  if (!call) throw new Error('Panggilan tidak ditemukan');

  call.sdpOffer = sdpOffer;
  call.updatedAt = Date.now();
  activeCalls.set(callId, call);

  try {
    const db = await readDb();
    if (db.activeCalls) {
      const idx = db.activeCalls.findIndex((c) => c.id === callId);
      if (idx !== -1) {
        db.activeCalls[idx] = call;
      } else {
        db.activeCalls.push(call);
      }
      await writeDb(db);
    }
  } catch {}

  return call;
}

export async function answerCallSession(
  callId: string,
  sdpAnswer: string,
  user?: { id: string; name: string; avatar: string }
): Promise<CallSession> {
  let call = activeCalls.get(callId);
  if (!call) {
    try {
      const db = await readDb();
      call = db.activeCalls?.find((c) => c.id === callId);
    } catch {}
  }
  if (!call) throw new Error('Panggilan tidak ditemukan');

  call.status = 'connected';
  if (!call.startedAt) call.startedAt = Date.now();
  call.sdpAnswer = sdpAnswer;
  call.updatedAt = Date.now();

  if (call.isGroup && user) {
    if (!call.participants) {
      call.participants = [
        {
          id: call.callerId,
          name: call.callerName,
          avatar: call.callerAvatar,
          joinedAt: call.startedAt,
        },
      ];
    }
    if (!call.participants.some((p) => p.id === user.id)) {
      call.participants.push({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        joinedAt: Date.now(),
      });
    }
  }

  activeCalls.set(callId, call);

  try {
    const db = await readDb();
    if (db.activeCalls) {
      const idx = db.activeCalls.findIndex((c) => c.id === callId);
      if (idx !== -1) {
        db.activeCalls[idx] = call;
      } else {
        db.activeCalls.push(call);
      }
      await writeDb(db);
    }
  } catch {}

  return call;
}

export async function joinGroupCallSession(
  callId: string,
  user: { id: string; name: string; avatar: string },
  sdpAnswer?: string
): Promise<CallSession> {
  return answerCallSession(callId, sdpAnswer || 'joined', user);
}

export async function inviteParticipantToCall(
  callId: string,
  targetUserId: string
): Promise<CallSession> {
  let call = activeCalls.get(callId);
  if (!call) {
    try {
      const db = await readDb();
      call = db.activeCalls?.find((c) => c.id === callId);
    } catch {}
  }
  if (!call) throw new Error('Panggilan tidak ditemukan');

  // If 1-on-1 call, upgrade session to group call mode
  if (!call.isGroup) {
    call.isGroup = true;
    call.receiverName = 'Panggilan Grup';
    if (!call.participants) {
      call.participants = [
        {
          id: call.callerId,
          name: call.callerName,
          avatar: call.callerAvatar,
          joinedAt: call.startedAt || Date.now(),
        },
      ];
      if (call.status === 'connected') {
        call.participants.push({
          id: call.receiverId,
          name: call.receiverName,
          avatar: call.receiverAvatar,
          joinedAt: call.startedAt || Date.now(),
        });
      }
    }
  }

  if (!call.groupMembers) call.groupMembers = [];
  if (!call.groupMembers.includes(targetUserId)) {
    call.groupMembers.push(targetUserId);
  }

  if (!call.invitedUsers) call.invitedUsers = [];
  if (!call.invitedUsers.includes(targetUserId)) {
    call.invitedUsers.push(targetUserId);
  }

  call.updatedAt = Date.now();
  activeCalls.set(callId, call);

  try {
    const db = await readDb();
    if (db.activeCalls) {
      const idx = db.activeCalls.findIndex((c) => c.id === callId);
      if (idx !== -1) {
        db.activeCalls[idx] = call;
      } else {
        db.activeCalls.push(call);
      }
      await writeDb(db);
    }
  } catch {}

  return call;
}

export async function setMeshSignal(
  callId: string,
  signal: { fromUserId: string; toUserId: string; type: 'offer' | 'answer'; sdp: string }
): Promise<CallSession> {
  let call = activeCalls.get(callId);
  if (!call) {
    try {
      const db = await readDb();
      call = db.activeCalls?.find((c) => c.id === callId);
    } catch {}
  }
  if (!call) throw new Error('Panggilan tidak ditemukan');

  if (!call.meshSignals) {
    call.meshSignals = {};
  }

  const key = `${signal.fromUserId}_${signal.toUserId}_${signal.type}`;
  call.meshSignals[key] = {
    ...signal,
    updatedAt: Date.now(),
  };
  call.updatedAt = Date.now();
  activeCalls.set(callId, call);

  try {
    const db = await readDb();
    if (db.activeCalls) {
      const idx = db.activeCalls.findIndex((c) => c.id === callId);
      if (idx !== -1) {
        db.activeCalls[idx] = call;
      } else {
        db.activeCalls.push(call);
      }
      await writeDb(db);
    }
  } catch {}

  return call;
}

export async function addIceCandidate(callId: string, candidate: any, fromUserId: string): Promise<void> {
  let call = activeCalls.get(callId);
  if (!call) {
    try {
      const db = await readDb();
      call = db.activeCalls?.find((c) => c.id === callId);
    } catch {}
  }
  if (!call) return;

  if (fromUserId === call.callerId) {
    if (!call.callerIce) call.callerIce = [];
    call.callerIce.push(candidate);
  } else {
    if (!call.receiverIce) call.receiverIce = [];
    call.receiverIce.push(candidate);
  }
  call.updatedAt = Date.now();
  activeCalls.set(callId, call);

  try {
    const db = await readDb();
    if (db.activeCalls) {
      const idx = db.activeCalls.findIndex((c) => c.id === callId);
      if (idx !== -1) {
        db.activeCalls[idx] = call;
        await writeDb(db);
      }
    }
  } catch {}
}

export async function endCallSession(
  callId: string,
  reason: 'ended' | 'rejected' = 'ended',
  userId?: string
): Promise<CallSession | null> {
  let call = activeCalls.get(callId);
  let db: any = null;
  try {
    db = await readDb();
  } catch {}

  if (!call && db?.activeCalls) {
    call = db.activeCalls.find((c: any) => c.id === callId);
  }

  if (!call) {
    // Clean up activeCalls entry in DB if lingering
    if (db?.activeCalls) {
      db.activeCalls = db.activeCalls.filter((c: any) => c.id !== callId);
      try {
        await writeDb(db);
      } catch {}
    }
    return null;
  }

  // Group call participant leaving: keep call alive for remaining members if more than 1 left
  if (call.isGroup && userId && call.participants && call.participants.length > 2) {
    call.participants = call.participants.filter((p: any) => p.id !== userId);
    call.updatedAt = Date.now();
    activeCalls.set(callId, call);
    try {
      if (db?.activeCalls) {
        const idx = db.activeCalls.findIndex((c: any) => c.id === callId);
        if (idx !== -1) {
          db.activeCalls[idx] = call;
          await writeDb(db);
        }
      }
    } catch {}
    return call;
  }

  const now = Date.now();
  const wasConnected = call.status === 'connected';
  const duration = call.startedAt ? Math.floor((now - call.startedAt) / 1000) : 0;

  call.status = reason;
  call.duration = duration;
  call.updatedAt = now;

  // Auto record call event in chat history
  try {
    const timeString = `${new Date().getHours().toString().padStart(2, '0')}:${new Date()
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    let callStatusText = '';
    let callHistoryStatus: 'missed' | 'completed' | 'declined' = 'completed';

    if (wasConnected && duration > 0) {
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const durationStr = mins > 0 ? `${mins}m ${secs}d` : `${secs} detik`;
      callStatusText = `Panggilan ${call.type === 'video' ? 'video' : 'suara'} (${durationStr})`;
      callHistoryStatus = 'completed';
    } else if (reason === 'rejected') {
      callStatusText = `Panggilan ${call.type === 'video' ? 'video' : 'suara'} ditolak`;
      callHistoryStatus = 'declined';
    } else {
      callStatusText = `Panggilan ${call.type === 'video' ? 'video' : 'suara'} tak terjawab`;
      callHistoryStatus = 'missed';
    }

    const historyMsg: Message = {
      id: `msg_call_${Date.now()}`,
      chatId: getChatRoomId(call.callerId, call.receiverId),
      senderId: call.callerId,
      recipientId: call.receiverId,
      senderName: call.callerName,
      type: 'call',
      text: callStatusText,
      callInfo: {
        type: call.type,
        status: callHistoryStatus,
        duration,
      },
      timestamp: timeString,
      status: 'read',
    };

    await saveMessage(historyMsg);
  } catch (err) {
    console.warn('[CallManager] Failed to record call in history:', err);
  }

  // Remove from in-memory and DB
  activeCalls.delete(callId);

  try {
    if (!db) {
      db = await readDb();
    }
    if (db?.activeCalls) {
      db.activeCalls = db.activeCalls.filter((c: any) => c.id !== callId);
      await writeDb(db);
    }
  } catch (err) {
    console.warn('[CallManager] Error deleting call from db:', err);
  }

  return call;
}
