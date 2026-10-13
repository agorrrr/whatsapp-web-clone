'use client';

import React, { useState, useEffect } from 'react';
import { UserAccount, ContactItem } from '../types/chat';
import { X, Search, MessageSquare, UserCheck } from 'lucide-react';

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
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers('');
  }, [currentUserId]);

  const fetchUsers = async (q: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/users?exclude=${currentUserId}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchUsers(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-[#e9edef] dark:border-[#222e35] flex flex-col max-h-[85vh]">
        {/* Top Header */}
        <div className="h-14 px-5 bg-[#008069] dark:bg-[#1f2c34] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5" />
            <span className="font-semibold text-base">Cari & Mulai Chat Pribadi</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-3 bg-[#f0f2f5] dark:bg-[#111b21] border-b border-[#e9edef] dark:border-[#222e35]">
          <div className="flex items-center bg-white dark:bg-[#202c33] rounded-xl px-3 py-2 text-sm text-[#111b21] dark:text-[#e9edef] border border-transparent focus-within:border-[#00a884]">
            <Search className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Cari berdasarkan @username, nama, atau email/telepon..."
              value={searchQuery}
              onChange={handleSearchChange}
              autoFocus
              className="w-full bg-transparent outline-none placeholder-[#8696a0]"
            />
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#e9edef]/60 dark:divide-[#222e35]/60 p-2">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#8696a0]">
              Memuat daftar kontak terdaftar...
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#8696a0]">
              Tidak ada pengguna yang cocok dengan pencarian "{searchQuery}".
            </div>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-[#f5f6f6] dark:hover:bg-[#111b21] transition-colors"
              >
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  <div className="relative flex-shrink-0">
                    <img
                      src={u.avatar}
                      alt={u.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    {u.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00a884] border-2 border-white dark:border-[#202c33]" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-sm text-[#111b21] dark:text-[#e9edef] truncate">
                        {u.name}
                      </span>
                      <span className="text-xs text-[#00a884] font-medium">
                        @{u.username}
                      </span>
                    </div>
                    <p className="text-xs text-[#8696a0] truncate mt-0.5">
                      {u.about || u.identifier}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onSelectUser(u);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold flex items-center space-x-1 flex-shrink-0 shadow transition-transform hover:scale-105"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Kirim Pesan</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
