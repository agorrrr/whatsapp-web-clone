'use client';

import React, { useState } from 'react';
import { Contact, UserProfile } from '../types/chat';
import {
  Search,
  MessageSquarePlus,
  MoreVertical,
  Pin,
  Check,
  CheckCheck,
  Mic,
  Image as ImageIcon,
  Sticker,
  Moon,
  Sun,
  UserCheck,
  Filter,
} from 'lucide-react';

interface ChatListProps {
  contacts: Contact[];
  activeContactId: string | null;
  onSelectContact: (contactId: string) => void;
  currentUser: UserProfile;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenNewChat: () => void;
  onOpenSettings: () => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  contacts,
  activeContactId,
  onSelectContact,
  currentUser,
  theme,
  onToggleTheme,
  onOpenNewChat,
  onOpenSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.lastMessage?.text || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterUnread ? c.unreadCount > 0 : true;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="w-full md:w-[400px] lg:w-[440px] flex-shrink-0 flex flex-col h-full bg-white dark:bg-[#111b21] border-r border-[#e9edef] dark:border-[#222e35]">
      {/* Top Header */}
      <div className="h-16 px-4 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between border-b border-[#e9edef] dark:border-[#222e35] select-none">
        {/* User profile avatar */}
        <div
          onClick={onOpenSettings}
          className="flex items-center space-x-3 cursor-pointer group"
          title="Pengaturan Profil"
        >
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-transparent group-hover:ring-[#00a884] transition-all"
          />
          <span className="font-semibold text-sm text-[#111b21] dark:text-[#e9edef] hidden sm:inline max-w-[120px] truncate">
            {currentUser.name}
          </span>
        </div>

        {/* Header Action Icons */}
        <div className="flex items-center space-x-3 text-[#54656f] dark:text-[#aebac1] relative">
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={onOpenNewChat}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Chat Baru"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Menu Opsi"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-11 w-48 bg-white dark:bg-[#233138] rounded-md shadow-xl py-2 z-50 border border-[#e9edef] dark:border-[#2a3942] text-sm text-[#111b21] dark:text-[#d1d7db]">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onOpenNewChat();
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Grup baru
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onOpenSettings();
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Pengaturan
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onToggleTheme();
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  {theme === 'dark' ? 'Tema Terang' : 'Tema Gelap'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search and Unread Filter Bar */}
      <div className="px-3 py-2 bg-white dark:bg-[#111b21] flex items-center space-x-2 border-b border-[#e9edef] dark:border-[#222e35]">
        <div className="flex-1 flex items-center bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-3 py-1.5 text-xs text-[#111b21] dark:text-[#e9edef]">
          <Search className="w-4 h-4 text-[#54656f] dark:text-[#8696a0] mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Cari atau mulai chat baru"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent outline-none placeholder-[#54656f] dark:placeholder-[#8696a0]"
          />
        </div>

        <button
          onClick={() => setFilterUnread(!filterUnread)}
          className={`p-2 rounded-full transition-colors ${
            filterUnread
              ? 'bg-[#00a884] text-white'
              : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#54656f] dark:text-[#8696a0]'
          }`}
          title="Filter pesan belum dibaca"
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* WhatsApp Feature Notification Strip */}
      <div className="bg-[#f0f2f5]/60 dark:bg-[#182229] px-4 py-2 text-[12px] text-[#54656f] dark:text-[#8696a0] border-b border-[#e9edef] dark:border-[#222e35] flex items-center justify-between">
        <span>🔒 Enkripsi end-to-end aktif</span>
        <span className="text-[10px] text-[#00a884] font-medium">WhatsApp Web Clone</span>
      </div>

      {/* Chat List Scrollable Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#e9edef]/60 dark:divide-[#222e35]/60">
        {filteredContacts.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#54656f] dark:text-[#8696a0]">
            Tidak ada chat yang cocok.
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const isActive = contact.id === activeContactId;
            const lastMsg = contact.lastMessage;
            const isMeLast = lastMsg?.senderId === 'me';

            return (
              <div
                key={contact.id}
                onClick={() => onSelectContact(contact.id)}
                className={`flex items-center px-3 py-3 cursor-pointer transition-colors relative select-none ${
                  isActive
                    ? 'bg-[#f0f2f5] dark:bg-[#2a3942]'
                    : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'
                }`}
              >
                {/* Contact Avatar */}
                <div className="relative mr-3 flex-shrink-0">
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  {contact.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#00a884] border-2 border-white dark:border-[#111b21]" />
                  )}
                </div>

                {/* Contact Info & Last Message */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[15px] text-[#111b21] dark:text-[#e9edef] truncate">
                      {contact.name}
                    </span>
                    <span
                      className={`text-[12px] whitespace-nowrap ml-2 ${
                        contact.unreadCount > 0
                          ? 'text-[#00a884] font-semibold'
                          : 'text-[#667781] dark:text-[#8696a0]'
                      }`}
                    >
                      {lastMsg?.timestamp || ''}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-[13px] text-[#667781] dark:text-[#8696a0] truncate pr-2">
                      {contact.isTyping ? (
                        <span className="text-[#00a884] font-medium animate-pulse">
                          sedang mengetik...
                        </span>
                      ) : (
                        <>
                          {isMeLast && (
                            <span className="mr-1 inline-flex items-center flex-shrink-0">
                              {lastMsg?.status === 'read' ? (
                                <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                              ) : lastMsg?.status === 'delivered' ? (
                                <CheckCheck className="w-3.5 h-3.5 text-[#8696a0]" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-[#8696a0]" />
                              )}
                            </span>
                          )}

                          {lastMsg?.type === 'audio' && (
                            <span className="inline-flex items-center mr-1 text-[#00a884]">
                              <Mic className="w-3.5 h-3.5 mr-0.5" />
                              Pesan Suara
                            </span>
                          )}

                          {lastMsg?.type === 'image' && (
                            <span className="inline-flex items-center mr-1 text-[#00a884]">
                              <ImageIcon className="w-3.5 h-3.5 mr-0.5" />
                              Foto
                            </span>
                          )}

                          {lastMsg?.type === 'sticker' && (
                            <span className="inline-flex items-center mr-1 text-[#00a884]">
                              <Sticker className="w-3.5 h-3.5 mr-0.5" />
                              Stiker
                            </span>
                          )}

                          {lastMsg?.type === 'text' && (
                            <span className="truncate">{lastMsg.text}</span>
                          )}

                          {!lastMsg && (
                            <span className="italic truncate">{contact.about || 'Mulai obrolan'}</span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Right indicators: Pinned & Unread badge */}
                    <div className="flex items-center space-x-1.5 flex-shrink-0">
                      {contact.pinned && (
                        <Pin className="w-3.5 h-3.5 text-[#667781] dark:text-[#8696a0] transform rotate-45" />
                      )}
                      {contact.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 min-w-[20px] text-center rounded-full bg-[#00a884] text-white text-[11px] font-bold">
                          {contact.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
