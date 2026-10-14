import { CallSession, CallType, CallStatus, Message } from '../types/chat';
import { findUserById, saveMessage, getChatRoomId } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __waActiveCalls: Map<string, CallSession> | undefined;
}

if (!global.__waActiveCalls) {
  global.__waActiveCalls = new Map<string, CallSession>();
}

const activeCalls = global.__waActiveCalls;

// Prune calls older than 2 minutes
function pruneOldCalls() {
  const now = Date.now();
  activeCalls.forEach((call, id) => {
    if (now - call.updatedAt > 120000 || call.status === 'ended' || call.status === 'rejected') {
      if (now - call.updatedAt > 15000) {
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
  const receiver = await findUserById(receiverId);

  // Check if receiver is already in a call
  let isBusy = false;
  activeCalls.forEach((call) => {
    if (
      (call.receiverId === receiverId || call.callerId === receiverId) &&
      (call.status === 'ringing' || call.status === 'connected')
    ) {
      isBusy = true;
    }
  });
  if (isBusy) {
    throw new Error('Pengguna sedang dalam panggilan lain (sibuk)');
  }

  const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const session: CallSession = {
    id: callId,
    callerId,
    callerName: caller?.name || 'Pengguna',
    callerAvatar:
      caller?.avatar ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    receiverId,
    receiverName: receiver?.name || 'Pengguna',
    receiverAvatar:
      receiver?.avatar ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    type,
    status: 'ringing',
    sdpOffer,
    callerIce: [],
    receiverIce: [],
    updatedAt: Date.now(),
  };

  activeCalls.set(callId, session);
  return session;
}

export function getActiveCallForUser(userId: string): CallSession | null {
  pruneOldCalls();
  let found: CallSession | null = null;
  activeCalls.forEach((call) => {
    if (
      !found &&
      (call.callerId === userId || call.receiverId === userId) &&
      (call.status === 'ringing' || call.status === 'connected')
    ) {
      found = call;
    }
  });
  return found;
}

export function getCallById(callId: string): CallSession | null {
  return activeCalls.get(callId) || null;
}

export function setCallOffer(callId: string, sdpOffer: string): CallSession {
  const call = activeCalls.get(callId);
  if (!call) throw new Error('Panggilan tidak ditemukan');

  call.sdpOffer = sdpOffer;
  call.updatedAt = Date.now();
  return call;
}

export function answerCallSession(callId: string, sdpAnswer: string): CallSession {
  const call = activeCalls.get(callId);
  if (!call) throw new Error('Panggilan tidak ditemukan');

  call.status = 'connected';
  call.startedAt = Date.now();
  call.sdpAnswer = sdpAnswer;
  call.updatedAt = Date.now();
  return call;
}

export function addIceCandidate(callId: string, candidate: any, fromUserId: string): void {
  const call = activeCalls.get(callId);
  if (!call) return;

  if (fromUserId === call.callerId) {
    if (!call.callerIce) call.callerIce = [];
    call.callerIce.push(candidate);
  } else {
    if (!call.receiverIce) call.receiverIce = [];
    call.receiverIce.push(candidate);
  }
  call.updatedAt = Date.now();
}

export async function endCallSession(
  callId: string,
  reason: 'ended' | 'rejected' = 'ended'
): Promise<CallSession | null> {
  const call = activeCalls.get(callId);
  if (!call) return null;

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

  return call;
}
