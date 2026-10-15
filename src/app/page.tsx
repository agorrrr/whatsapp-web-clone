'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserAccount, ContactItem, Message, MessageType, GroupChat, CallSession, CallType, StoryItem, UserStoryGroup } from '../types/chat';
import { ChatList } from '../components/ChatList';
import { ChatWindow } from '../components/ChatWindow';
import { EmptyChat } from '../components/EmptyChat';
import { AuthModal } from '../components/AuthModal';
import { NewPrivateChatModal } from '../components/NewPrivateChatModal';
import { EditProfileModal } from '../components/EditProfileModal';
import { NewGroupModal } from '../components/NewGroupModal';
import { GroupInfoModal } from '../components/GroupInfoModal';
import { SyncRealWaModal } from '../components/SyncRealWaModal';
import { CallModal } from '../components/CallModal';
import { UserProfileModal } from '../components/UserProfileModal';
import { StatusDrawer } from '../components/StatusDrawer';
import { CreateStoryModal } from '../components/CreateStoryModal';
import { StoryViewerModal } from '../components/StoryViewerModal';
import { StarredMessagesModal } from '../components/StarredMessagesModal';
import { getStoredTheme, saveStoredTheme } from '../utils/storage';

const SESSION_USER_KEY = 'wa_clone_active_user_v3';
const LOCAL_CONTACTS_KEY = 'wa_clone_user_contacts_v3_';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [inspectedUser, setInspectedUser] = useState<ContactItem | UserAccount | null>(null);

  // Stories
  const [myStories, setMyStories] = useState<StoryItem[]>([]);
  const [friendStories, setFriendStories] = useState<UserStoryGroup[]>([]);
  const [showStatusDrawer, setShowStatusDrawer] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [activeViewingStoryGroup, setActiveViewingStoryGroup] = useState<UserStoryGroup | null>(null);

  // Modals
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSyncRealWa, setShowSyncRealWa] = useState(false);
  const [showStarredModal, setShowStarredModal] = useState(false);

  const channelRef = useRef<BroadcastChannel | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);
  const dismissedCallIdsRef = useRef<Map<string, number>>(new Map());

  // Initialize theme & session
  useEffect(() => {
    const savedTheme = getStoredTheme();
    setTheme(savedTheme);

    try {
      const rawUser = localStorage.getItem(SESSION_USER_KEY);
      if (rawUser) {
        const u = JSON.parse(rawUser);
        setCurrentUser(u);
      }
    } catch {}

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    setMounted(true);
  }, []);

  // Update theme class on document element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    saveStoredTheme(theme);
  }, [theme]);

  // Load contacts for current user from localStorage
  useEffect(() => {
    if (!currentUser) {
      setContacts([]);
      setActiveContactId(null);
      return;
    }

    const key = LOCAL_CONTACTS_KEY + currentUser.id;
    let saved: ContactItem[] = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) saved = JSON.parse(raw);
    } catch {}

    setContacts(saved);
  }, [currentUser]);

  // Save contacts for current user whenever updated
  useEffect(() => {
    if (currentUser && contacts.length > 0) {
      const key = LOCAL_CONTACTS_KEY + currentUser.id;
      localStorage.setItem(key, JSON.stringify(contacts));
    }
  }, [contacts, currentUser]);

  // Play subtle native WhatsApp pop sound on incoming message
  const playNotificationSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(950, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }, []);

  // Universal real-time sync (catches messages from friends, strangers, groups)
  const syncRealtimeData = useCallback(async () => {
    if (!currentUser || isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      const activeParam = activeContactId ? `&activeContactId=${encodeURIComponent(activeContactId)}` : '';
      const res = await fetch(
        `/api/sync?userId=${encodeURIComponent(currentUser.id)}${activeParam}&_t=${Date.now()}`,
        {
          cache: 'no-store',
          headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
        }
      );
      const data = await res.json();
      if (!data.success) return;

      // 1. Update active chat messages in real time
      if (activeContactId && Array.isArray(data.activeMessages)) {
        setMessages((prev) => {
          if (
            prev.length !== data.activeMessages.length ||
            prev[prev.length - 1]?.id !== data.activeMessages[data.activeMessages.length - 1]?.id
          ) {
            return data.activeMessages;
          }
          return prev;
        });
      }

      // 2. Track new incoming messages & play sound & show native notification
      if (Array.isArray(data.allUserMessages)) {
        let hasNewIncoming = false;
        let lastIncomingMsg: Message | null = null;
        data.allUserMessages.forEach((m: Message) => {
          if (!seenMessageIdsRef.current.has(m.id)) {
            seenMessageIdsRef.current.add(m.id);
            if (m.senderId !== currentUser.id && initialLoadDoneRef.current) {
              hasNewIncoming = true;
              lastIncomingMsg = m;
            }
          }
        });
        if (hasNewIncoming) {
          playNotificationSound();
          if (
            lastIncomingMsg &&
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted' &&
            (document.hidden || !document.hasFocus())
          ) {
            try {
              const msgRef: Message = lastIncomingMsg;
              const notif = new Notification(msgRef.senderName || 'Pesan Baru', {
                body:
                  msgRef.text ||
                  (msgRef.type === 'document'
                    ? `Berkas: ${msgRef.fileName || 'Dokumen'}`
                    : msgRef.type === 'audio'
                    ? 'Pesan Suara'
                    : 'Media Foto/Stiker'),
                icon: '/favicon.ico',
              });
              notif.onclick = () => {
                window.focus();
                if (msgRef.senderId) {
                  setActiveContactId(msgRef.senderId);
                }
                notif.close();
              };
            } catch {}
          }
        }
      }

      // 3. Update or instantiate contacts (including strangers and groups!)
      setContacts((prev) => {
        let updated = [...prev];

        // A. Add any sender not yet in contacts (stranger who just sent a message)
        if (Array.isArray(data.senders)) {
          data.senders.forEach((sender: Partial<UserAccount>) => {
            if (!sender.id || sender.id === currentUser.id) return;
            const existingIdx = updated.findIndex((c) => c.id === sender.id);
            if (existingIdx === -1) {
              const newContact: ContactItem = {
                id: sender.id,
                username: sender.username,
                name: sender.name || 'Pengguna',
                avatar:
                  sender.avatar ||
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
                about: sender.about || 'Ada di Ini Bukan Whatsapp',
                isOnline: sender.isOnline ?? true,
                unreadCount: 1,
              };
              updated.unshift(newContact);
            } else {
              updated[existingIdx] = {
                ...updated[existingIdx],
                name: sender.name || updated[existingIdx].name,
                avatar: sender.avatar || updated[existingIdx].avatar,
                isOnline: sender.isOnline ?? updated[existingIdx].isOnline,
              };
            }
          });
        }

        // B. Sync groups
        if (Array.isArray(data.groups)) {
          data.groups.forEach((g: GroupChat) => {
            const idx = updated.findIndex((c) => c.id === g.id);
            if (idx !== -1) {
              updated[idx] = {
                ...updated[idx],
                name: g.name,
                avatar: g.avatar,
                about: g.description,
                isGroup: true,
                participantsCount: g.members.length,
              };
            } else {
              const groupContact: ContactItem = {
                id: g.id,
                name: g.name,
                avatar: g.avatar,
                about: g.description,
                isGroup: true,
                participantsCount: g.members.length,
                isOnline: false,
                unreadCount: 0,
              };
              updated.unshift(groupContact);
            }
          });
        }

        // C. Update latest message & unread status
        if (Array.isArray(data.allUserMessages)) {
          data.allUserMessages.forEach((msg: Message) => {
            const isGroupMsg = msg.chatId?.startsWith('grp_') || msg.recipientId?.startsWith('grp_');
            const targetId = isGroupMsg
              ? (msg.chatId?.startsWith('grp_') ? msg.chatId : msg.recipientId!)
              : (msg.senderId === currentUser.id ? msg.recipientId : msg.senderId);

            if (!targetId) return;
            const cIdx = updated.findIndex((c) => c.id === targetId);
            if (cIdx !== -1) {
              const currentLastMsg = updated[cIdx].lastMessage;
              if (!currentLastMsg || currentLastMsg.timestamp <= msg.timestamp) {
                updated[cIdx] = {
                  ...updated[cIdx],
                  lastMessage: {
                    text:
                      msg.text ||
                      (msg.type === 'audio' ? 'Pesan Suara' : msg.type === 'image' ? 'Foto' : 'Stiker'),
                    timestamp: msg.timestamp,
                    type: msg.type,
                    senderId: msg.senderId,
                    senderName: msg.senderName,
                    status: msg.status,
                  },
                };
              }
            }
          });
        }

        // D. Sync pinned & typing status
        const pinnedList = Array.isArray(data.pinnedChatIds) ? data.pinnedChatIds : [];
        const activeTypingList = Array.isArray(data.activeTyping) ? data.activeTyping : [];

        updated = updated.map((c) => {
          const isPinned = pinnedList.includes(c.id);
          const isTyping = activeTypingList.some(
            (t: any) =>
              (t.chatId === c.id || t.chatId.includes(c.id)) && t.userId !== currentUser.id
          );
          return {
            ...c,
            pinned: isPinned,
            isTyping: !!isTyping,
          };
        });

        return updated;
      });

      // 4. Update active call status
      if (data.activeCall) {
        const dismissedAt = dismissedCallIdsRef.current.get(data.activeCall.id);
        const isDismissed = dismissedAt && Date.now() - dismissedAt < 60000;

        if (
          isDismissed ||
          data.activeCall.status === 'ended' ||
          data.activeCall.status === 'rejected'
        ) {
          setActiveCall(null);
        } else {
          setActiveCall((prev) => {
            if (
              !prev ||
              prev.id !== data.activeCall.id ||
              prev.status !== data.activeCall.status ||
              prev.sdpOffer !== data.activeCall.sdpOffer ||
              prev.sdpAnswer !== data.activeCall.sdpAnswer ||
              (prev.callerIce?.length || 0) !== (data.activeCall.callerIce?.length || 0) ||
              (prev.receiverIce?.length || 0) !== (data.activeCall.receiverIce?.length || 0)
            ) {
              return data.activeCall;
            }
            return prev;
          });
        }
      } else {
        setActiveCall((prev) =>
          prev?.status === 'ringing' || prev?.status === 'ended' || prev?.status === 'rejected'
            ? null
            : prev
        );
      }

      // 5. Update active stories
      try {
        const storyRes = await fetch(`/api/stories?userId=${currentUser.id}`);
        if (storyRes.ok) {
          const sData = await storyRes.json();
          if (sData.success) {
            setMyStories(sData.myStories || []);
            setFriendStories(sData.friendStories || []);
          }
        }
      } catch (sErr) {
        console.warn('Stories sync error:', sErr);
      }

      initialLoadDoneRef.current = true;
    } catch (err) {
      console.warn('Realtime sync error:', err);
    } finally {
      isSyncingRef.current = false;
    }
  }, [currentUser, activeContactId, playNotificationSound]);

  // Polling (every 2.5s) & immediate focus/visibility wakeup
  useEffect(() => {
    if (!currentUser) return;

    syncRealtimeData();

    // Broadcast channel for multi-tab sync
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('wa_private_chat_sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'call_update' && event.data.call) {
          setActiveCall(event.data.call);
        } else if (event.data?.type === 'call_offer') {
          setActiveCall((prev) =>
            prev && prev.id === event.data.callId
              ? { ...prev, sdpOffer: event.data.sdpOffer }
              : prev
          );
        } else if (event.data?.type === 'call_answer') {
          setActiveCall((prev) =>
            prev && prev.id === event.data.callId
              ? { ...prev, sdpAnswer: event.data.sdpAnswer, status: 'connected' }
              : prev
          );
        } else if (event.data?.type === 'call_ice') {
          setActiveCall((prev) => {
            if (!prev || prev.id !== event.data.callId) return prev;
            const isFromCaller = event.data.fromUserId === prev.callerId;
            return {
              ...prev,
              callerIce: isFromCaller
                ? [...(prev.callerIce || []), event.data.candidate]
                : prev.callerIce,
              receiverIce: !isFromCaller
                ? [...(prev.receiverIce || []), event.data.candidate]
                : prev.receiverIce,
            };
          });
          return;
        } else if (event.data?.type === 'call_mesh_signal') {
          const { callId, signal } = event.data;
          setActiveCall((prev) => {
            if (!prev || prev.id !== callId) return prev;
            const key = `${signal.fromUserId}_${signal.toUserId}_${signal.type}`;
            return {
              ...prev,
              meshSignals: {
                ...(prev.meshSignals || {}),
                [key]: { ...signal, updatedAt: Date.now() },
              },
            };
          });
          return;
        } else if (event.data?.type === 'delete_message') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === event.data.messageId
                ? event.data.updatedMessage || { ...m, isDeleted: true, text: 'Pesan ini telah dihapus' }
                : m
            )
          );
          syncRealtimeData();
          return;
        } else if (event.data?.type === 'call_end') {
          if (event.data?.callId) {
            dismissedCallIdsRef.current.set(event.data.callId, Date.now());
          }
          setActiveCall(null);
        }
        syncRealtimeData();
      };
      channelRef.current = bc;
    }

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncRealtimeData();
      }
    };

    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    pollingTimerRef.current = setInterval(() => {
      syncRealtimeData();
    }, 2500);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      channelRef.current?.close();
    };
  }, [currentUser, syncRealtimeData]);

  const handleSendMessage = async ({
    type,
    text,
    mediaUrl,
    fileName,
    fileSize,
    audioDuration,
    locationInfo,
    replyTo,
  }: {
    type: MessageType;
    text?: string;
    mediaUrl?: string;
    fileName?: string;
    fileSize?: string;
    audioDuration?: number;
    locationInfo?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    replyTo?: Message;
  }) => {
    if (!currentUser || !activeContactId) return;

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          recipientId: activeContactId,
          type,
          text,
          mediaUrl,
          fileName,
          fileSize,
          audioDuration,
          locationInfo,
          replyTo: replyTo
            ? {
                id: replyTo.id,
                senderName: replyTo.senderId === currentUser.id ? 'Anda' : replyTo.senderName || '',
                text: replyTo.text || replyTo.type,
                type: replyTo.type,
              }
            : undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) => [...prev, data.message]);
        seenMessageIdsRef.current.add(data.message.id);
        channelRef.current?.postMessage(data.message);
        syncRealtimeData();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `/api/messages?messageId=${encodeURIComponent(messageId)}&userId=${encodeURIComponent(currentUser.id)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? data.message : m))
        );
        channelRef.current?.postMessage({
          type: 'delete_message',
          messageId,
          updatedMessage: data.message,
        });
        syncRealtimeData();
      }
    } catch (err) {
      console.error('Delete message error:', err);
    }
  };

  const handleTogglePinChat = async (chatId: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/chats/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, chatId }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.pinnedChatIds)) {
        setContacts((prev) =>
          prev.map((c) => ({
            ...c,
            pinned: data.pinnedChatIds.includes(c.id),
          }))
        );
      } else if (!data.success && data.message) {
        alert(data.message);
      }
    } catch {
      alert('Gagal menyematkan chat');
    }
  };

  const handleToggleStar = async (messageId: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/messages/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, userId: currentUser.id }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            const currentStarred = Array.isArray(m.starredBy) ? [...m.starredBy] : [];
            const idx = currentStarred.indexOf(currentUser.id);
            if (idx > -1) {
              currentStarred.splice(idx, 1);
            } else {
              currentStarred.push(currentUser.id);
            }
            return { ...m, starredBy: currentStarred };
          })
        );
      }
    } catch (err) {
      console.error('Toggle star error:', err);
    }
  };

  const handleReaction = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, reaction: m.reaction === emoji ? undefined : emoji } : m
      )
    );
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleStartCall = async (type: CallType, targetUserId?: string) => {
    const receiverId = targetUserId || activeContactId;
    if (!currentUser || !receiverId) return;
    if (receiverId === currentUser.id) {
      alert('Tidak bisa memanggil akun sendiri. Silakan buka browser/tab lain dan login dengan akun teman yang berbeda.');
      return;
    }
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          callerId: currentUser.id,
          receiverId,
          type,
        }),
      });
      const data = await res.json();
      if (data.success && data.call) {
        setActiveCall(data.call);
        channelRef.current?.postMessage({ type: 'call_update', call: data.call });
      } else {
        alert(data.message || 'Gagal memulai panggilan');
      }
    } catch (err) {
      console.error('Call start error:', err);
    }
  };

  const handleOpenSenderProfile = async (senderId: string) => {
    const foundContact = contacts.find((c) => c.id === senderId);
    if (foundContact) {
      setInspectedUser(foundContact);
      return;
    }
    try {
      const res = await fetch(`/api/users?userId=${senderId}`);
      const data = await res.json();
      if (data.success && data.user) {
        setInspectedUser(data.user);
      }
    } catch {}
  };

  const handleAnswerCall = async (callId: string, sdpAnswer: string) => {
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'answer',
          callId,
          sdpAnswer,
          user: currentUser ? { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar } : undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.call) {
        setActiveCall(data.call);
        channelRef.current?.postMessage({ type: 'call_update', call: data.call });
      }
    } catch (err) {
      console.error('Call answer error:', err);
    }
  };

  const handleEndCall = async (callId: string, reason: 'ended' | 'rejected' = 'ended') => {
    dismissedCallIdsRef.current.set(callId, Date.now());
    setActiveCall(null);
    try {
      await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          callId,
          reason,
          userId: currentUser?.id,
        }),
      });
      channelRef.current?.postMessage({ type: 'call_end', callId });
      syncRealtimeData();
    } catch (err) {
      console.error('Call end error:', err);
    }
  };

  const handleSendOffer = async (callId: string, sdpOffer: string) => {
    try {
      await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'offer', callId, sdpOffer }),
      });
      setActiveCall((prev) => (prev && prev.id === callId ? { ...prev, sdpOffer } : prev));
      channelRef.current?.postMessage({ type: 'call_offer', callId, sdpOffer });
    } catch (err) {
      console.error('Send offer error:', err);
    }
  };

  const handleSendIce = async (callId: string, candidate: any) => {
    if (!currentUser) return;
    try {
      await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ice',
          callId,
          candidate,
          fromUserId: currentUser.id,
        }),
      });
      channelRef.current?.postMessage({
        type: 'call_ice',
        callId,
        candidate,
        fromUserId: currentUser.id,
      });
    } catch {}
  };

  const handleInviteParticipant = async (callId: string, targetUserId: string) => {
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', callId, targetUserId }),
      });
      const data = await res.json();
      if (data.success && data.call) {
        setActiveCall(data.call);
        channelRef.current?.postMessage({ type: 'call_update', call: data.call });
      }
    } catch (err) {
      console.error('Invite participant error:', err);
    }
  };

  const handleSendMeshSignal = async (
    callId: string,
    signal: { fromUserId: string; toUserId: string; type: 'offer' | 'answer'; sdp: string }
  ) => {
    try {
      await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mesh_signal', callId, signal }),
      });
      setActiveCall((prev) => {
        if (!prev || prev.id !== callId) return prev;
        const key = `${signal.fromUserId}_${signal.toUserId}_${signal.type}`;
        return {
          ...prev,
          meshSignals: {
            ...(prev.meshSignals || {}),
            [key]: { ...signal, updatedAt: Date.now() },
          },
        };
      });
      channelRef.current?.postMessage({ type: 'call_mesh_signal', callId, signal });
    } catch (err) {
      console.error('Send mesh signal error:', err);
    }
  };

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_USER_KEY);
    setActiveContactId(null);
    setMessages([]);
    setContacts([]);
  };

  const handleUpdateProfileSuccess = (updated: UserAccount) => {
    setCurrentUser(updated);
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(updated));
  };

  // Story handlers
  const handleStoryCreated = (story: StoryItem) => {
    setMyStories((prev) => [...prev, story]);
    setShowCreateStory(false);
    syncRealtimeData();
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!currentUser) return;
    try {
      await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          storyId,
          userId: currentUser.id,
        }),
      });
      setMyStories((prev) => prev.filter((s) => s.id !== storyId));
      setActiveViewingStoryGroup((prev) => {
        if (!prev) return null;
        const remaining = prev.stories.filter((s) => s.id !== storyId);
        if (remaining.length === 0) return null;
        return { ...prev, stories: remaining };
      });
    } catch (err) {
      console.error('Delete story error:', err);
    }
  };

  const handleStoryViewed = async (storyId: string) => {
    if (!currentUser) return;
    try {
      await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'view',
          storyId,
          viewerId: currentUser.id,
        }),
      });
      setFriendStories((prev) =>
        prev.map((g) => {
          const updatedStories = g.stories.map((s) => {
            if (s.id === storyId && !s.viewers?.includes(currentUser.id)) {
              return { ...s, viewers: [...(s.viewers || []), currentUser.id] };
            }
            return s;
          });
          const hasUnviewed = updatedStories.some((s) => !s.viewers?.includes(currentUser.id));
          return { ...g, stories: updatedStories, hasUnviewed };
        })
      );
    } catch (err) {
      console.error('View story error:', err);
    }
  };

  const handleSendStoryReply = async (recipientId: string, replyText: string) => {
    if (!currentUser || !recipientId || !replyText.trim()) return;
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          recipientId,
          type: 'text',
          text: `Membalas status: ${replyText}`,
        }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        if (activeContactId === recipientId) {
          setMessages((prev) => [...prev, data.message]);
        }
        channelRef.current?.postMessage(data.message);
        syncRealtimeData();
      }
    } catch (err) {
      console.error('Send story reply error:', err);
    }
  };

  const handleNextStoryGroup = () => {
    if (!activeViewingStoryGroup || !currentUser) return;
    const allGroups: UserStoryGroup[] = [
      ...(myStories.length > 0
        ? [
            {
              userId: currentUser.id,
              userName: currentUser.name,
              userAvatar: currentUser.avatar,
              isSelf: true,
              stories: myStories,
              hasUnviewed: false,
              latestTimestamp: myStories[myStories.length - 1].createdAt,
            },
          ]
        : []),
      ...friendStories,
    ];
    const idx = allGroups.findIndex((g) => g.userId === activeViewingStoryGroup.userId);
    if (idx !== -1 && idx < allGroups.length - 1) {
      setActiveViewingStoryGroup(allGroups[idx + 1]);
    } else {
      setActiveViewingStoryGroup(null);
    }
  };

  const handlePrevStoryGroup = () => {
    if (!activeViewingStoryGroup || !currentUser) return;
    const allGroups: UserStoryGroup[] = [
      ...(myStories.length > 0
        ? [
            {
              userId: currentUser.id,
              userName: currentUser.name,
              userAvatar: currentUser.avatar,
              isSelf: true,
              stories: myStories,
              hasUnviewed: false,
              latestTimestamp: myStories[myStories.length - 1].createdAt,
            },
          ]
        : []),
      ...friendStories,
    ];
    const idx = allGroups.findIndex((g) => g.userId === activeViewingStoryGroup.userId);
    if (idx > 0) {
      setActiveViewingStoryGroup(allGroups[idx - 1]);
    }
  };

  const handleStartChatWithUser = (targetUser: UserAccount) => {
    setContacts((prev) => {
      const existing = prev.find((c) => c.id === targetUser.id);
      if (!existing) {
        const newContact: ContactItem = {
          id: targetUser.id,
          username: targetUser.username,
          name: targetUser.name,
          identifier: targetUser.identifier,
          avatar: targetUser.avatar,
          about: targetUser.about,
          isOnline: targetUser.isOnline ?? true,
          unreadCount: 0,
        };
        return [newContact, ...prev];
      }
      return prev.map((c) =>
        c.id === targetUser.id
          ? {
              ...c,
              name: targetUser.name || c.name,
              avatar: targetUser.avatar || c.avatar,
              username: targetUser.username || c.username,
            }
          : c
      );
    });
    setActiveContactId(targetUser.id);
  };

  const handleGroupCreated = (newGroup: GroupChat) => {
    const groupContact: ContactItem = {
      id: newGroup.id,
      name: newGroup.name,
      avatar: newGroup.avatar,
      about: newGroup.description,
      isGroup: true,
      participantsCount: newGroup.members.length,
      isOnline: false,
      unreadCount: 0,
    };
    setContacts((prev) => [groupContact, ...prev.filter((c) => c.id !== newGroup.id)]);
    setActiveContactId(newGroup.id);
  };

  const handleGroupUpdated = (updatedGroup: GroupChat) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === updatedGroup.id
          ? {
              ...c,
              name: updatedGroup.name,
              avatar: updatedGroup.avatar,
              about: updatedGroup.description,
              participantsCount: updatedGroup.members.length,
            }
          : c
      )
    );
  };

  const handleLeaveGroup = (groupId: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== groupId));
    if (activeContactId === groupId) {
      setActiveContactId(null);
    }
  };

  if (!mounted) {
    return (
      <div className="h-[100dvh] w-screen flex items-center justify-center bg-[#111b21] text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-3 border-[#00a884] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium tracking-wide">Ini Bukan Whatsapp...</span>
        </div>
      </div>
    );
  }

  // If not logged in, show Auth modal
  if (!currentUser) {
    return <AuthModal onSuccess={handleLoginSuccess} />;
  }

  const activeContact = contacts.find((c) => c.id === activeContactId);

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex flex-col justify-center items-center bg-[#d1d7db] dark:bg-[#0c1317] relative select-none">
      {/* WhatsApp Green Top Banner on large screens */}
      <div className="hidden md:block w-full h-32 bg-[#00a884] dark:bg-[#00a884] absolute top-0 left-0 z-0" />

      {/* Main WhatsApp Window Container */}
      <div className="w-full h-full md:w-[96vw] md:h-[95vh] md:max-w-[1600px] bg-white dark:bg-[#111b21] md:rounded-lg shadow-2xl flex overflow-hidden z-10 relative">
        {/* Left Side: Contact List or Status Drawer */}
        <div
          className={`${
            activeContactId ? 'hidden md:flex' : 'flex'
          } w-full md:w-[400px] lg:w-[440px] h-full flex-col flex-shrink-0 relative overflow-hidden`}
        >
          {showStatusDrawer ? (
            <StatusDrawer
              currentUser={currentUser}
              myStories={myStories}
              friendStories={friendStories}
              onClose={() => setShowStatusDrawer(false)}
              onOpenCreateStory={() => setShowCreateStory(true)}
              onViewStoryGroup={(group) => setActiveViewingStoryGroup(group)}
            />
          ) : (
            <ChatList
              contacts={contacts}
              activeContactId={activeContactId}
              onSelectContact={(id) => {
                setActiveContactId(id);
                setContacts((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
                );
              }}
              currentUser={currentUser}
              theme={theme}
              onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              onOpenNewChat={() => setShowNewChat(true)}
              onOpenNewGroup={() => setShowNewGroup(true)}
              onOpenEditProfile={() => setShowEditProfile(true)}
              onOpenSyncRealWa={() => setShowSyncRealWa(true)}
              onOpenProfile={(c) => setInspectedUser(c)}
              onOpenStatus={() => setShowStatusDrawer(true)}
              onTogglePinChat={handleTogglePinChat}
              onOpenStarredMessages={() => setShowStarredModal(true)}
              hasUnviewedStories={friendStories.some((f) => f.hasUnviewed)}
              storyUsersWithActiveStories={new Set(friendStories.map((f) => f.userId))}
              onLogout={handleLogout}
            />
          )}
        </div>

        {/* Right Side: Active Chat Window or Empty */}
        <div
          className={`${
            activeContactId ? 'flex' : 'hidden md:flex'
          } flex-1 h-full flex-col min-w-0`}
        >
          {activeContact ? (
            <ChatWindow
              contact={activeContact}
              currentUserId={currentUser.id}
              currentUserName={currentUser.name}
              messages={messages}
              onSendMessage={handleSendMessage}
              onReaction={handleReaction}
              onClearChat={handleClearChat}
              onDeleteMessage={handleDeleteMessage}
              onToggleStar={handleToggleStar}
              onBackMobile={() => setActiveContactId(null)}
              onOpenGroupInfo={() => setShowGroupInfo(true)}
              onOpenProfile={(c) => setInspectedUser(c)}
              onSenderClick={handleOpenSenderProfile}
              onStartCall={handleStartCall}
              theme={theme}
            />
          ) : (
            <EmptyChat />
          )}
        </div>
      </div>

      {/* New Private Chat Search Modal */}
      {showNewChat && (
        <NewPrivateChatModal
          currentUserId={currentUser.id}
          onSelectUser={handleStartChatWithUser}
          onClose={() => setShowNewChat(false)}
        />
      )}

      {/* New Group Modal */}
      {showNewGroup && (
        <NewGroupModal
          currentUserId={currentUser.id}
          onSuccess={handleGroupCreated}
          onClose={() => setShowNewGroup(false)}
        />
      )}

      {/* Group Info Modal */}
      {showGroupInfo && activeContact?.isGroup && (
        <GroupInfoModal
          groupId={activeContact.id}
          currentUserId={currentUser.id}
          onClose={() => setShowGroupInfo(false)}
          onGroupUpdated={handleGroupUpdated}
          onLeaveGroupSuccess={handleLeaveGroup}
          onOpenMemberProfile={(m) => setInspectedUser(m as any)}
        />
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <EditProfileModal
          currentUser={currentUser}
          onUpdateSuccess={handleUpdateProfileSuccess}
          onClose={() => setShowEditProfile(false)}
          onOpenSyncRealWa={() => setShowSyncRealWa(true)}
        />
      )}

      {/* Sync to Real WhatsApp Modal */}
      {showSyncRealWa && (
        <SyncRealWaModal
          currentUser={currentUser}
          onProfileSynced={handleUpdateProfileSuccess}
          onClose={() => setShowSyncRealWa(false)}
        />
      )}

      {/* Real-time WebRTC Call Modal */}
      {activeCall && currentUser && (
        <CallModal
          call={activeCall}
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          currentUserAvatar={currentUser.avatar}
          contacts={contacts}
          onEndCall={handleEndCall}
          onSendOffer={handleSendOffer}
          onAnswerCall={handleAnswerCall}
          onSendIce={handleSendIce}
          onInviteParticipant={handleInviteParticipant}
          onSendMeshSignal={handleSendMeshSignal}
        />
      )}

      {/* Contact Profile Inspector Modal */}
      {inspectedUser && currentUser && (
        <UserProfileModal
          user={inspectedUser}
          currentUserId={currentUser.id}
          onClose={() => setInspectedUser(null)}
          onStartChat={(target) => {
            handleStartChatWithUser(target as any);
            setInspectedUser(null);
          }}
          onStartCall={(type, target) => {
            handleStartCall(type, target.id);
            setInspectedUser(null);
          }}
        />
      )}

      {/* Create Story Modal */}
      {showCreateStory && currentUser && (
        <CreateStoryModal
          currentUser={currentUser}
          onClose={() => setShowCreateStory(false)}
          onStoryCreated={handleStoryCreated}
        />
      )}

      {/* Story Viewer Modal */}
      {activeViewingStoryGroup && currentUser && (
        <StoryViewerModal
          storyGroup={activeViewingStoryGroup}
          currentUserId={currentUser.id}
          onClose={() => setActiveViewingStoryGroup(null)}
          onNextGroup={handleNextStoryGroup}
          onPrevGroup={handlePrevStoryGroup}
          onDeleteStory={handleDeleteStory}
          onStoryViewed={handleStoryViewed}
          onSendReply={handleSendStoryReply}
        />
      )}

      {/* Starred Messages Modal */}
      {showStarredModal && currentUser && (
        <StarredMessagesModal
          userId={currentUser.id}
          onClose={() => setShowStarredModal(false)}
          onSelectChat={(chatId) => {
            const targetId = chatId.startsWith('grp_')
              ? chatId
              : chatId.split('__').find((id) => id !== currentUser.id);
            if (targetId) setActiveContactId(targetId);
          }}
          onUnstarSuccess={(msgId) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId
                  ? { ...m, starredBy: m.starredBy?.filter((u) => u !== currentUser.id) }
                  : m
              )
            );
          }}
        />
      )}
    </div>
  );
}
