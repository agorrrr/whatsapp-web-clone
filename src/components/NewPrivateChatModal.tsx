'use client';

import React, { useState } from 'react';
import { UserAccount } from '../types/chat';
import { X, Search, MessageSquare, UserCheck, UserX, Shield } from 'lucide-react';

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
  const [user, setUser] = useState<UserAccount | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!clean) {
      setUser(null);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/users?exclude=${currentUserId}&q=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        // Only return if username matches exactly (case insensitive, ignoring '@')
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
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-[#e9edef] dark:border-[#222e35] flex flex-col max-h-[85dvh]">
        {/* Top Header */}
        <div className="h-14 px-5 bg-[#008069] dark:bg-[#1f2c34] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5" />
            <span className="font-semibold text-sm">Mulai Chat Baru</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input bar */}
        <form onSubmit={handleSearch} className="p-3.5 bg-[#f0f2f5] dark:bg-[#111b21] border-b border-[#e9edef] dark:border-[#222e35] flex-shrink-0">
          <div className="flex items-center bg-white dark:bg-[#202c33] rounded-xl px-3 py-2 text-sm text-[#111b21] dark:text-[#e9edef] border border-transparent focus-within:border-[#00a884] shadow-xs">
            <span className="text-[#00a884] font-bold mr-1">@</span>
            <input
              type="text"
              placeholder="Ketik username persis (misal: user2)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="w-full bg-transparent outline-none placeholder-[#8696a0] text-sm"
            />
            <button
              type="submit"
              className="p-1.5 rounded-lg bg-[#00a884] hover:bg-[#008f70] text-white ml-2 flex-shrink-0 transition-colors"
              title="Cari"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Search Result or Hidden Privacy Placeholder */}
        <div className="p-5 flex-1 flex flex-col items-center justify-center text-center">
          {loading ? (
            <div className="flex flex-col items-center space-y-3 py-8">
              <div className="w-8 h-8 border-3 border-[#00a884] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[#8696a0]">Mencari username @{searchQuery.replace(/^@/, '')}...</span>
            </div>
          ) : user ? (
            /* User Found Card */
            <div className="w-full bg-[#f0f2f5] dark:bg-[#111b21] rounded-2xl p-4 flex flex-col items-center border border-[#e9edef] dark:border-[#222e35] shadow-xs animate-fadeIn">
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
                {user.about || 'Ada di WhatsApp Web'}
              </p>

              <button
                onClick={() => {
                  onSelectUser(user);
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-md transition-transform hover:scale-[1.02]"
              >
                <UserCheck className="w-4 h-4" />
                <span>Kirim Pesan Pribadi</span>
              </button>
            </div>
          ) : hasSearched ? (
            /* Not Found */
            <div className="py-6 flex flex-col items-center">
              <UserX className="w-12 h-12 text-[#8696a0] mb-2 stroke-1" />
              <p className="text-sm font-semibold text-[#111b21] dark:text-[#e9edef]">
                Pengguna Tidak Ditemukan
              </p>
              <p className="text-xs text-[#8696a0] max-w-xs mt-1">
                Tidak ada pengguna dengan username "@{searchQuery.replace(/^@/, '')}". Pastikan ejaan username sudah benar.
              </p>
            </div>
          ) : (
            /* Privacy Placeholder (Names Hidden) */
            <div className="py-8 flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-[#00a884]/10 flex items-center justify-center mb-3">
                <Shield className="w-7 h-7 text-[#00a884]" />
              </div>
              <p className="text-sm font-semibold text-[#111b21] dark:text-[#e9edef]">
                Daftar Pengguna Dirahasiakan
              </p>
              <p className="text-xs text-[#8696a0] max-w-xs mt-1 leading-relaxed">
                Demi privasi, daftar semua pengguna tidak ditampilkan. Masukkan @username teman Anda di atas untuk memulai chat.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
