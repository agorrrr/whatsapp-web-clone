'use client';

import React, { useState, useEffect } from 'react';
import { Contact, Message, MessageType, UserProfile } from '../types/chat';
import { ChatList } from '../components/ChatList';
import { ChatWindow } from '../components/ChatWindow';
import { EmptyChat } from '../components/EmptyChat';
import { SettingsModal } from '../components/SettingsModal';
import { NewChatModal } from '../components/NewChatModal';
import {
  getStoredContacts,
  saveStoredContacts,
  getStoredMessages,
  saveStoredMessages,
  getStoredUser,
  saveStoredUser,
  getStoredTheme,
  saveStoredTheme,
} from '../utils/storage';
import { INITIAL_CONTACTS, INITIAL_MESSAGES, CURRENT_USER } from '../utils/mockData';
import { generateBotReply } from '../utils/botEngine';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentUser, setCurrentUser] = useState<UserProfile>(CURRENT_USER);
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [messages, setMessages] = useState<Record<string, Message[]>>(INITIAL_MESSAGES);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);

  // Hydrate from localStorage on client
  useEffect(() => {
    const savedTheme = getStoredTheme();
    const savedUser = getStoredUser();
    const savedContacts = getStoredContacts();
    const savedMessages = getStoredMessages();

    setTheme(savedTheme);
    setCurrentUser(savedUser);
    setContacts(savedContacts);
    setMessages(savedMessages);
    if (savedContacts.length > 0) {
      setActiveContactId(savedContacts[0].id);
    }
    setMounted(true);
  }, []);

  // Update HTML dark class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    saveStoredTheme(theme);
  }, [theme]);

  // Persist contacts whenever they change
  useEffect(() => {
    if (mounted) {
      saveStoredContacts(contacts);
    }
  }, [contacts, mounted]);

  // Persist messages whenever they change
  useEffect(() => {
    if (mounted) {
      saveStoredMessages(messages);
    }
  }, [messages, mounted]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSelectContact = (id: string) => {
    setActiveContactId(id);
    // Mark messages as read
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  };

  const handleSendMessage = ({
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
    if (!activeContactId) return;

    const contact = contacts.find((c) => c.id === activeContactId);
    if (!contact) return;

    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    const newMsg: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      chatId: activeContactId,
      senderId: 'me',
      type,
      text,
      mediaUrl,
      audioDuration,
      timestamp: timeString,
      status: 'sent',
      replyTo: replyTo
        ? {
            id: replyTo.id,
            senderName: replyTo.senderId === 'me' ? 'Anda' : contact.name,
            text: replyTo.text || replyTo.type,
            type: replyTo.type,
          }
        : undefined,
    };

    // Append to messages
    const updatedChatMessages = [...(messages[activeContactId] || []), newMsg];
    setMessages((prev) => ({
      ...prev,
      [activeContactId]: updatedChatMessages,
    }));

    // Update contact last message
    setContacts((prev) =>
      prev.map((c) =>
        c.id === activeContactId
          ? {
              ...c,
              lastMessage: {
                text: text || (type === 'audio' ? 'Pesan Suara' : type === 'image' ? 'Foto' : 'Stiker'),
                timestamp: timeString,
                type,
                senderId: 'me',
                status: 'sent',
              },
            }
          : c
      )
    );

    // Simulate delivery ticks after 300ms
    setTimeout(() => {
      setMessages((prev) => {
        const currentList = prev[activeContactId] || [];
        return {
          ...prev,
          [activeContactId]: currentList.map((m) =>
            m.id === newMsg.id ? { ...m, status: 'delivered' } : m
          ),
        };
      });
      setContacts((prev) =>
        prev.map((c) =>
          c.id === activeContactId && c.lastMessage
            ? { ...c, lastMessage: { ...c.lastMessage, status: 'delivered' } }
            : c
        )
      );
    }, 400);

    // Trigger Bot Auto-reply simulation
    const replyData = generateBotReply(contact, newMsg);

    // Show typing status after 600ms
    setTimeout(() => {
      setContacts((prev) =>
        prev.map((c) => (c.id === activeContactId ? { ...c, isTyping: true } : c))
      );
    }, 600);

    // Deliver response
    setTimeout(() => {
      const replyTime = new Date();
      const replyTimeString = `${replyTime.getHours().toString().padStart(2, '0')}:${replyTime
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;

      const incomingMsg: Message = {
        id: `msg_bot_${Date.now()}`,
        chatId: activeContactId,
        senderId: contact.id,
        senderName: contact.name,
        type: replyData.type,
        text: replyData.text,
        mediaUrl: replyData.mediaUrl,
        timestamp: replyTimeString,
        status: 'read',
      };

      setMessages((prev) => {
        const chatList = prev[activeContactId] || [];
        // Mark all user outgoing messages as read (blue ticks)
        const markedRead = chatList.map((m) =>
          m.senderId === 'me' ? { ...m, status: 'read' as const } : m
        );
        return {
          ...prev,
          [activeContactId]: [...markedRead, incomingMsg],
        };
      });

      setContacts((prev) =>
        prev.map((c) =>
          c.id === activeContactId
            ? {
                ...c,
                isTyping: false,
                lastMessage: {
                  text: replyData.text || (replyData.type === 'sticker' ? 'Stiker' : 'Media'),
                  timestamp: replyTimeString,
                  type: replyData.type,
                  senderId: contact.id,
                  status: 'read',
                },
              }
            : c
        )
      );
    }, 600 + replyData.delayMs);
  };

  const handleReaction = (messageId: string, emoji: string) => {
    if (!activeContactId) return;
    setMessages((prev) => {
      const list = prev[activeContactId] || [];
      return {
        ...prev,
        [activeContactId]: list.map((m) =>
          m.id === messageId ? { ...m, reaction: m.reaction === emoji ? undefined : emoji } : m
        ),
      };
    });
  };

  const handleClearChat = () => {
    if (!activeContactId) return;
    setMessages((prev) => ({
      ...prev,
      [activeContactId]: [],
    }));
    setContacts((prev) =>
      prev.map((c) =>
        c.id === activeContactId
          ? {
              ...c,
              lastMessage: undefined,
              unreadCount: 0,
            }
          : c
      )
    );
  };

  const handleAddContact = (newContact: Contact) => {
    setContacts((prev) => [newContact, ...prev]);
    setMessages((prev) => ({
      ...prev,
      [newContact.id]: [],
    }));
    setActiveContactId(newContact.id);
  };

  const handleUpdateUser = (updatedUser: UserProfile) => {
    setCurrentUser(updatedUser);
    saveStoredUser(updatedUser);
  };

  const handleResetData = () => {
    localStorage.clear();
    setContacts(INITIAL_CONTACTS);
    setMessages(INITIAL_MESSAGES);
    setCurrentUser(CURRENT_USER);
    setActiveContactId(INITIAL_CONTACTS[0].id);
    setShowSettings(false);
  };

  if (!mounted) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#111b21] text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#00a884] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium tracking-wide">WhatsApp Web...</span>
        </div>
      </div>
    );
  }

  const activeContact = contacts.find((c) => c.id === activeContactId);
  const activeMessages = activeContactId ? messages[activeContactId] || [] : [];

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col justify-center items-center bg-[#d1d7db] dark:bg-[#0c1317] relative">
      {/* WhatsApp Green Top Banner on large screens */}
      <div className="hidden md:block w-full h-32 bg-[#00a884] dark:bg-[#00a884] absolute top-0 left-0 z-0" />

      {/* Main WhatsApp Window Container */}
      <div className="w-full h-full md:w-[96vw] md:h-[95vh] md:max-w-[1600px] bg-white dark:bg-[#111b21] md:rounded-lg shadow-2xl flex overflow-hidden z-10 relative">
        {/* Left Side: Contact List */}
        <div
          className={`${
            activeContactId ? 'hidden md:flex' : 'flex'
          } w-full md:w-[400px] lg:w-[440px] h-full flex-col`}
        >
          <ChatList
            contacts={contacts}
            activeContactId={activeContactId}
            onSelectContact={handleSelectContact}
            currentUser={currentUser}
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenNewChat={() => setShowNewChat(true)}
            onOpenSettings={() => setShowSettings(true)}
          />
        </div>

        {/* Right Side: Active Chat Window or Empty placeholder */}
        <div
          className={`${
            activeContactId ? 'flex' : 'hidden md:flex'
          } flex-1 h-full flex-col`}
        >
          {activeContact ? (
            <ChatWindow
              contact={activeContact}
              messages={activeMessages}
              onSendMessage={handleSendMessage}
              onReaction={handleReaction}
              onClearChat={handleClearChat}
              onBackMobile={() => setActiveContactId(null)}
              theme={theme}
            />
          ) : (
            <EmptyChat />
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          currentUser={currentUser}
          theme={theme}
          onUpdateUser={handleUpdateUser}
          onToggleTheme={toggleTheme}
          onResetData={handleResetData}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* New Chat Modal */}
      {showNewChat && (
        <NewChatModal
          onAddContact={handleAddContact}
          onClose={() => setShowNewChat(false)}
        />
      )}
    </div>
  );
}
