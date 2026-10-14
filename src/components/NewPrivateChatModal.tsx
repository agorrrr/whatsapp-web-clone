'use client';

import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types/chat';
import {
  X,
  Search,
  MessageSquare,
  UserCheck,
  UserX,
  UserPlus,
  Users,
  Check,
  Loader2,
} from 'lucide-react';

interface NewPrivateChatModalProps {
  currentUserId: string;
  onSelectUser: (user: UserAccount) => void;
  onClose: () => void;
}

export const NewPrivateChatModal: React.FC<NewPrivateChatModalProps> = ({
  currentUserId,
  onSelectUser,
  onClose,
}) => {
  const [friends, setFriends] = useState<UserAccount[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Load user's friends automatically
  const fetchFriends = async () => {
    setLoadingFriends(true);
    try {
      const res = await fetch(`/api/friends?userId=${encodeURIComponent(currentUserId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.friends)) {
        setFriends(data.friends);
      }
    } catch (err) {
      console.warn('Gagal memuat teman:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, [currentUserId]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!clean) {
      setUser(null);
      setHasSearched(false);
      return;
    }

    setSearching(true);
    setHasSearched(true);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/users?exclude=${currentUserId}&q=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        const exactMatch = data.users.find(
          (u: UserAccount) => u.username?.toLowerCase() === clean
        );
        setUser(exactMatch || null);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Error searching user:', err);
      setUser(null);
    } finally {
      setSearching(false);
    }
  };

  const handleAddFriend = async (targetUser: UserAccount) => {
    setActionLoading(true);
    setActionFeedback(null);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          friendUsernameOrId: targetUser.username || targetUser.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.friends)) {
          setFriends(data.friends);
        } else {
          setFriends((prev) => [...prev.filter((f) => f.id !== targetUser.id), targetUser]);
        }
        setActionFeedback(`Berhasil berteman dengan @${targetUser.username}!`);
      } else {
        setActionFeedback(data.message || 'Gagal menambah teman');
      }
    } catch (err) {
      setActionFeedback('Koneksi bermasalah');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setUser(null);
    setHasSearched(false);
    setActionFeedback(null);
  };

  const isAlreadyFriend = (targetId: string) => friends.some((f) => f.id === targetId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-[#e9edef] dark:border-[#222e35] flex flex-col h-[560px] max-h-[90dvh]">
        {/* Top Header */}
        <div className="h-14 px-5 bg-[#008069] dark:bg-[#1f2c34] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span className="font-semibold text-sm">Pesan Baru & Teman</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input bar */}
        <form
          onSubmit={handleSearch}
          className="p-3.5 bg-[#f0f2f5] dark:bg-[#111b21] border-b border-[#e9edef] dark:border-[#222e35] flex-shrink-0"
        >
          <div className="flex items-center bg-white dark:bg-[#202c33] rounded-xl px-3 py-2 text-sm text-[#111b21] dark:text-[#e9edef] border border-transparent focus-within:border-[#00a884] shadow-xs">
            <span className="text-[#00a884] font-bold mr-1">@</span>
            <input
              type="text"
              placeholder="Cari username teman (misal: sabeena)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-transparent outline-none placeholder-[#8696a0] text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#8696a0] mr-1"
                title="Hapus pencarian"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="p-1.5 rounded-lg bg-[#00a884] hover:bg-[#008f70] text-white flex-shrink-0 transition-colors"
              title="Cari atau Tambah Teman"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {searching ? (
            /* Loading Search */
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
              <Loader2 className="w-8 h-8 text-[#00a884] animate-spin" />
              <span className="text-xs text-[#8696a0]">
                Mencari username @{searchQuery.replace(/^@/, '')}...
              </span>
            </div>
          ) : user ? (
            /* Search Result: Found User */
            <div className="p-5 flex-1 flex flex-col items-center justify-center text-center animate-fadeIn">
              <div className="w-full bg-[#f0f2f5] dark:bg-[#111b21] rounded-2xl p-5 flex flex-col items-center border border-[#e9edef] dark:border-[#222e35] shadow-xs">
                <div className="relative mb-3">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-20 h-20 rounded-full object-cover ring-4 ring-[#00a884]/30"
                  />
                  {user.isOnline && (
                    <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[#00a884] border-2 border-white dark:border-[#111b21]" />
                  )}
                </div>

                <h4 className="font-bold text-base text-[#111b21] dark:text-[#e9edef]">
                  {user.name}
                </h4>
                <span className="text-xs font-semibold text-[#00a884] mb-1">
                  @{user.username}
                </span>
                <p className="text-xs text-[#8696a0] max-w-xs truncate mb-4">
                  {user.about || 'Ada di Ini Bukan Whatsapp'}
                </p>

                {actionFeedback && (
                  <div className="w-full mb-3 px-3 py-1.5 rounded-lg bg-[#00a884]/10 text-[#00a884] text-xs font-medium">
                    {actionFeedback}
                  </div>
                )}

                <div className="w-full flex flex-col gap-2">
                  {isAlreadyFriend(user.id) ? (
                    <div className="py-2 px-3 rounded-xl bg-[#00a884]/10 text-[#00a884] text-xs font-bold flex items-center justify-center space-x-1.5">
                      <Check className="w-4 h-4" />
                      <span>Sudah Berteman</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddFriend(user)}
                      disabled={actionLoading}
                      className="w-full py-2.5 rounded-xl border border-[#00a884] text-[#00a884] hover:bg-[#00a884]/10 text-xs font-bold flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      <span>Tambah Sebagai Teman</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onSelectUser(user);
                      onClose();
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-md transition-transform hover:scale-[1.01]"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Mulai Chat</span>
                  </button>
                </div>
              </div>

              <button
                onClick={handleClearSearch}
                className="mt-4 text-xs text-[#00a884] hover:underline"
              >
                ← Kembali ke daftar teman
              </button>
            </div>
          ) : hasSearched ? (
            /* Search Result: Not Found */
            <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
              <UserX className="w-12 h-12 text-[#8696a0] mb-2 stroke-1" />
              <p className="text-sm font-semibold text-[#111b21] dark:text-[#e9edef]">
                Pengguna Tidak Ditemukan
              </p>
              <p className="text-xs text-[#8696a0] max-w-xs mt-1">
                Tidak ada pengguna dengan username "@{searchQuery.replace(/^@/, '')}".
              </p>
              <button
                onClick={handleClearSearch}
                className="mt-4 text-xs text-[#00a884] hover:underline"
              >
                ← Kembali ke daftar teman
              </button>
            </div>
          ) : loadingFriends ? (
            /* Loading Friends */
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
              <Loader2 className="w-7 h-7 text-[#00a884] animate-spin" />
              <span className="text-xs text-[#8696a0]">Memuat teman Anda...</span>
            </div>
          ) : friends.length > 0 ? (
            /* Friends List (User is already friends with them) */
            <div className="flex-1 flex flex-col divide-y divide-[#e9edef] dark:divide-[#222e35]">
              <div className="px-4 py-2.5 bg-[#f0f2f5]/70 dark:bg-[#111b21]/70 flex items-center justify-between text-xs font-bold text-[#54656f] dark:text-[#8696a0] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                <span>Teman Anda ({friends.length})</span>
                <span className="text-[11px] text-[#00a884] normal-case font-normal">
                  Pilih untuk langsung chat
                </span>
              </div>

              <div className="divide-y divide-[#e9edef] dark:divide-[#222e35]">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    onClick={() => {
                      onSelectUser(friend);
                      onClose();
                    }}
                    className="flex items-center px-4 py-3 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] cursor-pointer transition-colors space-x-3.5 group"
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={friend.avatar}
                        alt={friend.name}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-[#00a884]/30"
                      />
                      {friend.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00a884] border-2 border-white dark:border-[#111b21]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h5 className="font-semibold text-sm text-[#111b21] dark:text-[#e9edef] group-hover:text-[#00a884] transition-colors truncate">
                          {friend.name}
                        </h5>
                        <span className="text-[11px] text-[#00a884] font-medium flex-shrink-0">
                          @{friend.username}
                        </span>
                      </div>
                      <p className="text-xs text-[#8696a0] truncate mt-0.5">
                        {friend.about || 'Ada di Ini Bukan Whatsapp'}
                      </p>
                    </div>

                    <div className="p-2 rounded-full bg-transparent group-hover:bg-[#00a884]/10 text-[#8696a0] group-hover:text-[#00a884] transition-colors flex-shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* No Friends Yet Placeholder */
            <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-[#00a884]/10 flex items-center justify-center mb-3 text-[#00a884]">
                <UserPlus className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-[#111b21] dark:text-[#e9edef]">
                Belum Ada Teman
              </p>
              <p className="text-xs text-[#8696a0] max-w-xs mt-1.5 leading-relaxed">
                Ketik <span className="text-[#00a884] font-semibold">@username</span> teman di kolom atas lalu cari untuk menambah teman. Setelah berteman, nama teman akan otomatis muncul di sini!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
