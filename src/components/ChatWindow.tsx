'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UserAccount, GroupChat } from '../types/chat';
import {
  X,
  ArrowLeft,
  ArrowRight,
  Check,
  Camera,
  Users,
  Search,
  Loader2,
  Upload,
} from 'lucide-react';

interface NewGroupModalProps {
  currentUserId: string;
  onSuccess: (newGroup: GroupChat) => void;
  onClose: () => void;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({
  currentUserId,
  onSuccess,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2>(1); // 1 = select members, 2 = group info
  const [friends, setFriends] = useState<UserAccount[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Step 2 state
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupAvatar, setGroupAvatar] = useState(
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80'
  );
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load friends to add to group
  useEffect(() => {
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
    fetchFriends();
  }, [currentUserId]);

  const toggleSelectMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setGroupAvatar(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setErrorMsg('Nama grup wajib diisi');
      return;
    }

    setCreating(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim(),
          avatar: groupAvatar,
          creatorId: currentUserId,
          memberIds: selectedMemberIds,
        }),
      });

      const data = await res.json();
      if (data.success && data.group) {
        onSuccess(data.group);
        onClose();
      } else {
        setErrorMsg(data.message || 'Gagal membuat grup');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Koneksi bermasalah saat membuat grup');
    } finally {
      setCreating(false);
    }
  };

  const filteredFriends = friends.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-[#e9edef] dark:border-[#222e35] flex flex-col h-[580px] max-h-[90dvh]">
        {/* Top Header */}
        <div className="h-14 px-5 bg-[#008069] dark:bg-[#1f2c34] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="p-1 -ml-1 rounded-full hover:bg-white/10 transition-colors mr-1"
                title="Kembali"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <Users className="w-5 h-5" />
            <span className="font-semibold text-sm">
              {step === 1 ? 'Tambah Anggota Grup' : 'Info Grup Baru'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 1 ? (
          /* STEP 1: Select Members */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search Friends Input */}
            <div className="p-3 bg-[#f0f2f5] dark:bg-[#111b21] border-b border-[#e9edef] dark:border-[#222e35] flex-shrink-0">
              <div className="flex items-center bg-white dark:bg-[#202c33] rounded-xl px-3 py-2 text-sm text-[#111b21] dark:text-[#e9edef] shadow-xs">
                <Search className="w-4 h-4 text-[#8696a0] mr-2" />
                <input
                  type="text"
                  placeholder="Cari teman untuk ditambahkan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent outline-none placeholder-[#8696a0] text-sm"
                />
              </div>
            </div>

            {/* Selected Members Pills */}
            {selectedMemberIds.length > 0 && (
              <div className="px-3 py-2 bg-[#f8f9fa] dark:bg-[#182229] border-b border-[#e9edef] dark:border-[#222e35] flex flex-wrap gap-1.5 max-h-24 overflow-y-auto flex-shrink-0">
                {selectedMemberIds.map((id) => {
                  const m = friends.find((f) => f.id === id);
                  return (
                    <div
                      key={id}
                      className="flex items-center bg-[#00a884]/15 dark:bg-[#00a884]/25 text-[#00a884] px-2.5 py-1 rounded-full text-xs font-semibold space-x-1"
                    >
                      <img
                        src={m?.avatar}
                        alt={m?.name || ''}
                        className="w-4 h-4 rounded-full object-cover"
                      />
                      <span className="max-w-[100px] truncate">{m?.name || 'Teman'}</span>
                      <button
                        onClick={() => toggleSelectMember(id)}
                        className="hover:text-red-500 transition-colors ml-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Friend List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#e9edef] dark:divide-[#222e35]">
              {loadingFriends ? (
                <div className="p-8 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-7 h-7 text-[#00a884] animate-spin" />
                  <span className="text-xs text-[#8696a0]">Memuat daftar teman...</span>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#8696a0]">
                  {friends.length === 0
                    ? 'Belum ada teman terdaftar. Tambah teman terlebih dahulu via tombol Tambah Teman.'
                    : 'Tidak ada teman yang cocok dengan pencarian.'}
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const isSelected = selectedMemberIds.includes(friend.id);
                  return (
                    <div
                      key={friend.id}
                      onClick={() => toggleSelectMember(friend.id)}
                      className={`flex items-center px-4 py-3 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] cursor-pointer transition-colors space-x-3.5 ${
                        isSelected ? 'bg-[#00a884]/10 dark:bg-[#00a884]/15' : ''
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={friend.avatar}
                          alt={friend.name}
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-[#00a884]/30"
                        />
                        {isSelected && (
                          <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#00a884] text-white flex items-center justify-center border-2 border-white dark:border-[#111b21]">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h5 className="font-semibold text-sm text-[#111b21] dark:text-[#e9edef] truncate">
                            {friend.name}
                          </h5>
                          <span className="text-[11px] text-[#00a884] font-medium">
                            @{friend.username}
                          </span>
                        </div>
                        <p className="text-xs text-[#8696a0] truncate mt-0.5">
                          {friend.about || 'Ada di Ini Bukan Whatsapp'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Next Button */}
            <div className="p-4 bg-white dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#222e35] flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-[#8696a0]">
                {selectedMemberIds.length} anggota dipilih
              </span>
              <button
                onClick={() => setStep(2)}
                disabled={selectedMemberIds.length === 0}
                className="py-2.5 px-5 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-bold flex items-center space-x-2 shadow-md transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              >
                <span>Lanjut</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: Group Info & Avatar */
          <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col justify-between p-6">
            <div className="flex flex-col items-center">
              {/* Group Avatar Upload */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative cursor-pointer group mb-4"
                title="Ubah foto grup"
              >
                <img
                  src={groupAvatar}
                  alt="Avatar Grup"
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-[#00a884]/30"
                />
                <div className="absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-bold">Ubah Foto</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFile}
                  className="hidden"
                />
              </div>

              {errorMsg && (
                <div className="w-full mb-3 p-2 rounded-lg bg-red-500/10 text-red-500 text-xs text-center font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Group Name input */}
              <div className="w-full mb-4">
                <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                  Nama Grup *
                </label>
                <input
                  type="text"
                  placeholder="Ketik subjek / nama grup..."
                  value={groupName}
                  maxLength={50}
                  onChange={(e) => setGroupName(e.target.value)}
                  autoFocus
                  required
                  className="w-full bg-[#f0f2f5] dark:bg-[#111b21] rounded-xl px-3.5 py-2.5 text-sm text-[#111b21] dark:text-[#e9edef] border border-[#e9edef] dark:border-[#222e35] outline-none focus:border-[#00a884]"
                />
              </div>

              {/* Group Description input */}
              <div className="w-full mb-4">
                <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                  Deskripsi Grup (Opsional)
                </label>
                <textarea
                  placeholder="Tambahkan deskripsi grup..."
                  value={groupDescription}
                  maxLength={200}
                  rows={3}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className="w-full bg-[#f0f2f5] dark:bg-[#111b21] rounded-xl px-3.5 py-2 text-sm text-[#111b21] dark:text-[#e9edef] border border-[#e9edef] dark:border-[#222e35] outline-none focus:border-[#00a884] resize-none"
                />
              </div>

              {/* Members preview */}
              <div className="w-full bg-[#f0f2f5]/60 dark:bg-[#111b21]/60 rounded-xl p-3 flex items-center justify-between text-xs text-[#8696a0]">
                <span>Anggota: {selectedMemberIds.length} teman + Anda (Admin)</span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[#00a884] font-semibold hover:underline"
                >
                  Ubah
                </button>
              </div>
            </div>

            {/* Create Button */}
            <button
              type="submit"
              disabled={creating || !groupName.trim()}
              className="w-full py-3 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-lg transition-transform hover:scale-[1.01] disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Check className="w-5 h-5" />
              )}
              <span>Buat Grup</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
