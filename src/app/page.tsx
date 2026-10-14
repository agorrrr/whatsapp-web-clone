'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserAccount, ContactItem, Message, MessageType, GroupChat } from '../types/chat';
import { ChatList } from '../components/ChatList';
import { ChatWindow } from '../components/ChatWindow';
import { EmptyChat } from '../components/EmptyChat';
import { AuthModal } from '../components/AuthModal';
import { NewPrivateChatModal } from '../components/NewPrivateChatModal';
import { EditProfileModal } from '../components/EditProfileModal';
import { NewGroupModal } from '../components/NewGroupModal';
import { GroupInfoModal } from '../components/GroupInfoModal';
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

  // Modals
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const channelRef = useRef<BroadcastChannel | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Fetch messages between currentUser and activeContact
  const fetchActiveMessages = useCallback(async () => {
    if (!currentUser || !activeContactId) return;
    try {
      const res = await fetch(
        `/api/messages?userA=${encodeURIComponent(currentUser.id)}&userB=${encodeURIComponent(activeContactId)}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.warn('Error fetching messages:', err);
    }
  }, [currentUser, activeContactId]);

  // Fetch groups for current user
  const fetchUserGroups = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/groups?userId=${encodeURIComponent(currentUser.id)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        setContacts((prev) => {
          let updated = [...prev];
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
          return updated;
        });
      }
    } catch (err) {
      console.warn('Error fetching groups:', err);
    }
  }, [currentUser]);

  // Poll for messages every 2 seconds & sync across tabs
  useEffect(() => {
    if (!currentUser) return;

    fetchActiveMessages();
    fetchUserGroups();

    // Broadcast channel for multi-window / multi-tab local sync
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('wa_private_chat_sync');
      bc.onmessage = (event) => {
        const payload = event.data;
        if (
          payload &&
          (payload.recipientId === currentUser.id ||
            payload.senderId === currentUser.id ||
            payload.chatId?.startsWith('grp_') ||
            payload.recipientId?.startsWith('grp_'))
        ) {
          fetchActiveMessages();
          updateContactLastMessage(payload);
        }
      };
      channelRef.current = bc;
    }

    pollingTimerRef.current = setInterval(() => {
      fetchActiveMessages();
      fetchUserGroups();
    }, 2000);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      channelRef.current?.close();
    };
  }, [currentUser, activeContactId, fetchActiveMessages, fetchUserGroups]);

  const updateContactLastMessage = (msg: Message) => {
    const isGroupMsg = msg.chatId?.startsWith('grp_') || msg.recipientId?.startsWith('grp_');
    const targetContactId = isGroupMsg
      ? (msg.chatId?.startsWith('grp_') ? msg.chatId : msg.recipientId!)
      : (msg.senderId === currentUser?.id ? msg.recipientId : msg.senderId);

    if (!targetContactId) return;

    setContacts((prev) => {
      const exists = prev.some((c) => c.id === targetContactId);
      if (!exists) {
        if (isGroupMsg) {
          fetchUserGroups();
          return prev;
        }
        if (msg.senderId && msg.senderName) {
          const newContact: ContactItem = {
            id: targetContactId,
            name: msg.senderName,
            avatar:
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
            about: 'Kontak Ini Bukan Whatsapp',
            isOnline: true,
            unreadCount: targetContactId !== activeContactId ? 1 : 0,
            lastMessage: {
              text: msg.text || (msg.type === 'audio' ? 'Pesan Suara' : msg.type === 'image' ? 'Foto' : 'Stiker'),
              timestamp: msg.timestamp,
              type: msg.type,
              senderId: msg.senderId,
              status: msg.status,
            },
          };
          return [newContact, ...prev];
        }
      }

      return prev.map((c) =>
        c.id === targetContactId
          ? {
              ...c,
              lastMessage: {
                text: msg.text || (msg.type === 'audio' ? 'Pesan Suara' : msg.type === 'image' ? 'Foto' : 'Stiker'),
                timestamp: msg.timestamp,
                type: msg.type,
                senderId: msg.senderId,
                status: msg.status,
              },
              unreadCount:
                msg.senderId !== currentUser?.id && targetContactId !== activeContactId
                  ? c.unreadCount + 1
                  : c.unreadCount,
            }
          : c
      );
    });
  };

  const handleSendMessage = async ({
    type,
    text,
    mediaUrl,
    audioDuration,
    replyTo,
  }: {
    type: MessageType;
    text?: string;
    mediaUrl?: string;
    audioDuration?: number;
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
          audioDuration,
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
        updateContactLastMessage(data.message);
        channelRef.current?.postMessage(data.message);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
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
        {/* Left Side: Contact List */}
        <div
          className={`${
            activeContactId ? 'hidden md:flex' : 'flex'
          } w-full md:w-[400px] lg:w-[440px] h-full flex-col flex-shrink-0`}
        >
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
            onLogout={handleLogout}
          />
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
              messages={messages}
              onSendMessage={handleSendMessage}
              onReaction={handleReaction}
              onClearChat={handleClearChat}
              onBackMobile={() => setActiveContactId(null)}
              onOpenGroupInfo={() => setShowGroupInfo(true)}
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
        />
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <EditProfileModal
          currentUser={currentUser}
          onUpdateSuccess={handleUpdateProfileSuccess}
          onClose={() => setShowEditProfile(false)}
        />
      )}
    </div>
  );
}
