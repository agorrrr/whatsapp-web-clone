'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GroupChat, GroupMember, UserAccount } from '../types/chat';
import {
  X,
  Camera,
  Edit2,
  Check,
  UserPlus,
  LogOut,
  ShieldCheck,
  MoreVertical,
  Trash2,
  Shield,
  Loader2,
  Users,
} from 'lucide-react';

interface GroupInfoModalProps {
  groupId: string;
  currentUserId: string;
  onClose: () => void;
  onGroupUpdated: (updatedGroup: GroupChat) => void;
  onLeaveGroupSuccess: (groupId: string) => void;
}

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  groupId,
  currentUserId,
  onClose,
  onGroupUpdated,
  onLeaveGroupSuccess,
}) => {
  const [group, setGroup] = useState<GroupChat | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Editing state
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descVal, setDescVal] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  // Add Member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [friends, setFriends] = useState<UserAccount[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  // Active member menu dropdown
  const [activeMenuMemberId, setActiveMenuMemberId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchGroupDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups?groupId=${encodeURIComponent(groupId)}`);
      const data = await res.json();
      if (data.success && data.group) {
        setGroup(data.group);
        setMembers(data.members || []);
        setNameVal(data.group.name);
        setDescVal(data.group.description || '');
      } else {
        setErrorMsg(data.message || 'Gagal mengambil detail grup');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Koneksi bermasalah');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  const isAdmin = group?.admins.includes(currentUserId) ?? false;

  // Handle Photo Update
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
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
          await updateGroup({ avatar: dataUrl });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const updateGroup = async (updates: { name?: string; description?: string; avatar?: string }) => {
    setSavingInfo(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_info',
          groupId,
          userId: currentUserId,
          updates,
        }),
      });
      const data = await res.json();
      if (data.success && data.group) {
        setGroup(data.group);
        setMembers(data.members || []);
        onGroupUpdated(data.group);
      } else {
        setErrorMsg(data.message || 'Gagal mengubah info grup');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menyimpan perubahan');
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameVal.trim()) return;
    await updateGroup({ name: nameVal.trim() });
    setEditingName(false);
  };

  const handleSaveDesc = async () => {
    await updateGroup({ description: descVal.trim() });
    setEditingDesc(false);
  };

  // Open Add Member Picker
  const handleOpenAddMember = async () => {
    setShowAddMember(true);
    setLoadingFriends(true);
    try {
      const res = await fetch(`/api/friends?userId=${encodeURIComponent(currentUserId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.friends)) {
        // Only show friends who are not yet members
        const notMembers = data.friends.filter(
          (f: UserAccount) => !group?.members.includes(f.id)
        );
        setFriends(notMembers);
      }
    } catch {
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleAddMember = async (memberId: string) => {
    setAddingMember(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_members',
          groupId,
          userId: currentUserId,
          newMemberIds: [memberId],
        }),
      });
      const data = await res.json();
      if (data.success && data.group) {
        setGroup(data.group);
        setMembers(data.members || []);
        onGroupUpdated(data.group);
        setFriends((prev) => prev.filter((f) => f.id !== memberId));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menambahkan anggota');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (targetMemberId: string) => {
    if (!confirm('Apakah Anda yakin ingin mengeluarkan anggota ini dari grup?')) return;
    try {
      const res = await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_member',
          groupId,
          userId: currentUserId,
          targetMemberId,
        }),
      });
      const data = await res.json();
      if (data.success && data.group) {
        setGroup(data.group);
        setMembers(data.members || []);
        onGroupUpdated(data.group);
        setActiveMenuMemberId(null);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengeluarkan anggota');
    }
  };

  const handleToggleAdmin = async (targetMemberId: string) => {
    try {
      const res = await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_admin',
          groupId,
          userId: currentUserId,
          targetMemberId,
        }),
      });
      const data = await res.json();
      if (data.success && data.group) {
        setGroup(data.group);
        setMembers(data.members || []);
        onGroupUpdated(data.group);
        setActiveMenuMemberId(null);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengubah status admin');
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Apakah Anda yakin ingin keluar dari grup ini?')) return;
    try {
      const res = await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'leave_group',
          groupId,
          userId: currentUserId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onLeaveGroupSuccess(groupId);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal keluar dari grup');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3">
      <div className="bg-white dark:bg-[#111b21] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-[#e9edef] dark:border-[#222e35] flex flex-col h-[600px] max-h-[92dvh]">
        {/* Header */}
        <div className="h-14 px-5 bg-[#008069] dark:bg-[#1f2c34] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span className="font-semibold text-sm">Info Grup</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#00a884] animate-spin" />
            <span className="text-xs text-[#8696a0]">Memuat info grup...</span>
          </div>
        ) : !group ? (
          <div className="p-8 text-center text-xs text-red-500">
            {errorMsg || 'Grup tidak ditemukan'}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {errorMsg && (
              <div className="m-4 p-2.5 rounded-lg bg-red-500/10 text-red-500 text-xs text-center font-medium">
                {errorMsg}
              </div>
            )}

            {/* Group Hero (Avatar & Name) */}
            <div className="p-6 bg-white dark:bg-[#111b21] flex flex-col items-center border-b border-[#e9edef] dark:border-[#222e35]">
              <div
                onClick={() => isAdmin && fileInputRef.current?.click()}
                className={`relative group ${isAdmin ? 'cursor-pointer' : ''}`}
                title={isAdmin ? 'Ubah Foto Grup' : ''}
              >
                <img
                  src={group.avatar}
                  alt={group.name}
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-[#00a884]/30"
                />
                {isAdmin && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold">Ubah Foto</span>
                  </div>
                )}
                {isAdmin && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFile}
                    className="hidden"
                  />
                )}
              </div>

              {/* Group Name Display / Edit */}
              <div className="mt-4 flex items-center justify-center w-full">
                {editingName ? (
                  <div className="flex items-center space-x-2 w-full max-w-xs">
                    <input
                      type="text"
                      value={nameVal}
                      maxLength={50}
                      onChange={(e) => setNameVal(e.target.value)}
                      autoFocus
                      className="flex-1 bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-3 py-1.5 text-sm text-[#111b21] dark:text-[#e9edef] outline-none border border-[#00a884]"
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingInfo}
                      className="p-2 rounded-lg bg-[#00a884] text-white hover:bg-[#008f70]"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingName(false);
                        setNameVal(group.name);
                      }}
                      className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-[#8696a0]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-lg text-[#111b21] dark:text-[#e9edef]">
                      {group.name}
                    </h3>
                    {isAdmin && (
                      <button
                        onClick={() => setEditingName(true)}
                        className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#8696a0] hover:text-[#00a884] transition-colors"
                        title="Edit Nama Grup"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <span className="text-xs text-[#8696a0] mt-1">
                Grup · {members.length} peserta
              </span>
            </div>

            {/* Description Section */}
            <div className="p-4 bg-white dark:bg-[#111b21] border-b border-[#e9edef] dark:border-[#222e35]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[#00a884]">Deskripsi Grup</span>
                {isAdmin && !editingDesc && (
                  <button
                    onClick={() => setEditingDesc(true)}
                    className="p-1 text-[#8696a0] hover:text-[#00a884] transition-colors"
                    title="Edit Deskripsi"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {editingDesc ? (
                <div className="flex flex-col space-y-2">
                  <textarea
                    value={descVal}
                    maxLength={200}
                    rows={2}
                    onChange={(e) => setDescVal(e.target.value)}
                    className="w-full bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg p-2.5 text-xs text-[#111b21] dark:text-[#e9edef] outline-none border border-[#00a884] resize-none"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setEditingDesc(false);
                        setDescVal(group.description || '');
                      }}
                      className="px-3 py-1 rounded-md text-xs text-[#8696a0] hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSaveDesc}
                      disabled={savingInfo}
                      className="px-3 py-1 rounded-md text-xs font-bold bg-[#00a884] text-white hover:bg-[#008f70]"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#54656f] dark:text-[#8696a0] leading-relaxed whitespace-pre-wrap">
                  {group.description || 'Tidak ada deskripsi grup.'}
                </p>
              )}
            </div>

            {/* Members Section */}
            <div className="p-4 bg-white dark:bg-[#111b21] border-b border-[#e9edef] dark:border-[#222e35]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#54656f] dark:text-[#8696a0] uppercase tracking-wider">
                  {members.length} Peserta
                </span>
                {isAdmin && (
                  <button
                    onClick={handleOpenAddMember}
                    className="flex items-center space-x-1.5 text-xs font-bold text-[#00a884] hover:underline"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Tambah Anggota</span>
                  </button>
                )}
              </div>

              {/* Add Member Drawer / Sub-list */}
              {showAddMember && (
                <div className="mb-4 p-3 rounded-xl bg-[#f0f2f5] dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] animate-fadeIn">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#111b21] dark:text-[#e9edef]">
                      Pilih Teman untuk Ditambahkan
                    </span>
                    <button
                      onClick={() => setShowAddMember(false)}
                      className="p-1 rounded-full text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#e9edef]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {loadingFriends ? (
                    <div className="py-4 text-center text-xs text-[#8696a0]">
                      <Loader2 className="w-5 h-5 mx-auto animate-spin mb-1 text-[#00a884]" />
                      Memuat teman...
                    </div>
                  ) : friends.length === 0 ? (
                    <p className="text-xs text-[#8696a0] py-2">
                      Semua teman Anda sudah berada di dalam grup ini.
                    </p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto divide-y divide-[#e9edef] dark:divide-[#2a3942]">
                      {friends.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between py-2 text-xs"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <img
                              src={f.avatar}
                              alt={f.name}
                              className="w-7 h-7 rounded-full object-cover"
                            />
                            <div className="truncate">
                              <span className="font-semibold text-[#111b21] dark:text-[#e9edef] block truncate">
                                {f.name}
                              </span>
                              <span className="text-[10px] text-[#00a884]">@{f.username}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddMember(f.id)}
                            disabled={addingMember}
                            className="px-2.5 py-1 rounded-lg bg-[#00a884] text-white text-[11px] font-bold hover:bg-[#008f70] flex-shrink-0"
                          >
                            Tambah
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Members List */}
              <div className="divide-y divide-[#e9edef] dark:divide-[#222e35]">
                {members.map((member) => {
                  const isCurrent = member.id === currentUserId;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-2.5 relative group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-[#00a884]/20"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-sm text-[#111b21] dark:text-[#e9edef] truncate">
                              {isCurrent ? 'Anda' : member.name}
                            </span>
                            {member.username && (
                              <span className="text-[11px] text-[#8696a0]">
                                @{member.username}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#8696a0] truncate">
                            {member.about || 'Ada di Ini Bukan Whatsapp'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {member.isAdmin && (
                          <span className="px-2 py-0.5 rounded-full bg-[#00a884]/15 text-[#00a884] text-[10px] font-bold flex items-center space-x-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Admin Grup</span>
                          </span>
                        )}

                        {/* Admin Action Menu for other members */}
                        {isAdmin && !isCurrent && (
                          <div className="relative">
                            <button
                              onClick={() =>
                                setActiveMenuMemberId(
                                  activeMenuMemberId === member.id ? null : member.id
                                )
                              }
                              className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#8696a0]"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeMenuMemberId === member.id && (
                              <div className="absolute right-0 top-7 w-44 bg-white dark:bg-[#233138] rounded-xl shadow-xl py-1 z-30 border border-[#e9edef] dark:border-[#2a3942] text-xs">
                                <button
                                  onClick={() => handleToggleAdmin(member.id)}
                                  className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 flex items-center space-x-2 text-[#111b21] dark:text-[#e9edef]"
                                >
                                  <Shield className="w-3.5 h-3.5 text-[#00a884]" />
                                  <span>
                                    {member.isAdmin ? 'Berhentikan Admin' : 'Jadikan Admin Grup'}
                                  </span>
                                </button>
                                <button
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 flex items-center space-x-2 text-red-500"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Keluarkan dari Grup</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leave Group Action */}
            <div className="p-4 bg-white dark:bg-[#111b21]">
              <button
                onClick={handleLeaveGroup}
                className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-bold flex items-center justify-center space-x-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar dari Grup</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
