'use client';

import React, { useState } from 'react';
import { ContactItem, UserAccount } from '../types/chat';
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
  Filter,
  LogOut,
  User,
  Edit3,
  UserPlus,
} from 'lucide-react';

interface ChatListProps {
  contacts: ContactItem[];
  activeContactId: string | null;
  onSelectContact: (contactId: string) => void;
  currentUser: UserAccount;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenNewChat: () => void;
  onOpenEditProfile: () => void;
  onLogout: () => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  contacts,
  activeContactId,
  onSelectContact,
  currentUser,
  theme,
  onToggleTheme,
  onOpenNewChat,
  onOpenEditProfile,
  onLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.lastMessage?.text || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterUnread ? c.unreadCount > 0 : true;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#111b21] border-r border-[#e9edef] dark:border-[#222e35]">
      {/* Top Header */}
      <div className="h-16 px-4 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between border-b border-[#e9edef] dark:border-[#222e35] select-none flex-shrink-0">
        {/* User profile avatar & current account info */}
        <div
          onClick={onOpenEditProfile}
          className="flex items-center space-x-3 cursor-pointer group min-w-0 pr-2 hover:opacity-90 transition-opacity"
          title="Klik untuk ubah profil"
        >
          <div className="relative flex-shrink-0">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-[#00a884]/40"
            />
            <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Edit3 className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm text-[#111b21] dark:text-[#e9edef] truncate">
              {currentUser.name}
            </span>
            <span className="text-[11px] text-[#00a884] font-medium truncate">
              @{currentUser.username}
            </span>
          </div>
        </div>

        {/* Header Action Icons */}
        <div className="flex items-center space-x-1.5 text-[#54656f] dark:text-[#aebac1] relative flex-shrink-0">
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={onOpenNewChat}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[#00a884]"
            title="Tambah Teman Baru (@username)"
          >
            <UserPlus className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenNewChat}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[#54656f] dark:text-[#aebac1] hover:text-[#00a884]"
            title="Mulai Chat Baru"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Menu Akun"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-11 w-52 bg-white dark:bg-[#233138] rounded-xl shadow-xl py-2 z-50 border border-[#e9edef] dark:border-[#2a3942] text-sm text-[#111b21] dark:text-[#d1d7db]">
                <div className="px-4 py-2 border-b border-[#e9edef] dark:border-[#2a3942]">
                  <p className="font-semibold text-xs text-[#00a884]">@{currentUser.username}</p>
                  <p className="text-[11px] text-[#8696a0] truncate">{currentUser.identifier}</p>
                </div>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onOpenEditProfile();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center space-x-2"
                >
                  <Edit3 className="w-4 h-4 text-[#00a884]" />
                  <span>Ubah Profil & Foto</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onOpenNewChat();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center space-x-2"
                >
                  <UserPlus className="w-4 h-4 text-[#00a884]" />
                  <span>Tambah Teman / Chat Baru</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onToggleTheme();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  {theme === 'dark' ? 'Tema Terang' : 'Tema Gelap'}
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onLogout();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-red-500/10 text-red-500 flex items-center space-x-2 border-t border-[#e9edef] dark:border-[#2a3942]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar Akun</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="px-3 py-2 bg-white dark:bg-[#111b21] flex items-center space-x-2 border-b border-[#e9edef] dark:border-[#222e35] flex-shrink-0">
        <div className="flex-1 flex items-center bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-3 py-1.5 text-xs text-[#111b21] dark:text-[#e9edef]">
          <Search className="w-4 h-4 text-[#54656f] dark:text-[#8696a0] mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Cari chat atau @username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent outline-none placeholder-[#54656f] dark:placeholder-[#8696a0]"
          />
        </div>

        <button
          onClick={() => setFilterUnread(!filterUnread)}
          className={`p-2 rounded-full transition-colors flex-shrink-0 ${
            filterUnread
              ? 'bg-[#00a884] text-white'
              : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#54656f] dark:text-[#8696a0]'
          }`}
          title="Filter pesan belum dibaca"
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Security Status Strip */}
      <div className="bg-[#f0f2f5]/60 dark:bg-[#182229] px-4 py-2 text-[12px] text-[#54656f] dark:text-[#8696a0] border-b border-[#e9edef] dark:border-[#222e35] flex items-center justify-between flex-shrink-0">
        <span>?? Chat pribadi terenkripsi</span>
        <button
          onClick={onOpenNewChat}
          className="text-[11px] text-[#00a884] font-medium hover:underline"
        >
          + Chat Baru
        </button>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#e9edef]/60 dark:divide-[#222e35]/60">
        {filteredContacts.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center">
            <User className="w-12 h-12 text-[#8696a0] mb-2 stroke-1" />
            <p className="text-sm font-medium text-[#111b21] dark:text-[#e9edef]">
              Belum ada percakapan pribadi
            </p>
            <p className="text-xs text-[#8696a0] max-w-xs mt-1 mb-4">
              Cari @username teman yang sudah terdaftar untuk mulai berkirim pesan pribadi.
            </p>
            <button
              onClick={onOpenNewChat}
              className="px-4 py-2 rounded-lg bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold shadow"
            >
              Cari Pengguna Terdaftar
            </button>
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const isActive = contact.id === activeContactId;
            const lastMsg = contact.lastMessage;
            const isMeLast = lastMsg?.senderId === currentUser.id;

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
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center space-x-1 min-w-0">
                      <span className="font-semibold text-[15px] text-[#111b21] dark:text-[#e9edef] truncate">
                        {contact.name}
                      </span>
                      {contact.username && (
                        <span className="text-xs text-[#00a884] font-medium flex-shrink-0">
                          @{contact.username}
                        </span>
                      )}
                    </div>
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
                            <span className="italic truncate">{contact.about || 'Mulai chat pribadi'}</span>
                          )}
                        </>
                      )}
                    </div>

                    {contact.unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 min-w-[20px] text-center rounded-full bg-[#00a884] text-white text-[11px] font-bold flex-shrink-0">
                        {contact.unreadCount}
                      </span>
                    )}
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
