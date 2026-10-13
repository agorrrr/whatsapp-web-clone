'use client';

import React, { useState } from 'react';
import { UserAccount } from '../types/chat';
import { X, Camera, Check, User, FileText } from 'lucide-react';

interface EditProfileModalProps {
  currentUser: UserAccount;
  onUpdateSuccess: (updated: UserAccount) => void;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  currentUser,
  onUpdateSuccess,
  onClose,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [about, setAbout] = useState(currentUser.about || 'Ada di WhatsApp Web Clone');
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const AVATAR_PRESETS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  ];

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/users/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          name: name.trim(),
          avatar,
          about: about.trim(),
        }),
      });

      const data = await res.json();
      if (data.success && data.user) {
        onUpdateSuccess(data.user);
        onClose();
      } else {
        setErrorMsg(data.message || 'Gagal menyimpan profil');
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-[#e9edef] dark:border-[#222e35] max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="h-14 px-5 bg-[#008069] dark:bg-[#1f2c34] text-white flex items-center justify-between flex-shrink-0">
          <span className="font-semibold text-base">Ubah Profil Saya</span>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-5 mt-3 p-2.5 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-lg">
            {errorMsg}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Avatar with upload overlay */}
          <div className="flex flex-col items-center">
            <div className="relative group cursor-pointer">
              <img
                src={avatar}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover ring-4 ring-[#00a884]/30"
              />
              <label className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="w-6 h-6 mb-0.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Ganti Foto</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFile}
                />
              </label>
            </div>
            <label className="mt-2 text-xs text-[#00a884] font-medium cursor-pointer hover:underline">
              Pilih foto dari perangkat
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFile}
              />
            </label>

            {/* Quick avatar presets */}
            <div className="flex space-x-2 mt-3">
              {AVATAR_PRESETS.map((p, idx) => (
                <img
                  key={idx}
                  src={p}
                  alt={`Preset ${idx}`}
                  onClick={() => setAvatar(p)}
                  className={`w-8 h-8 rounded-full object-cover cursor-pointer ring-2 transition-transform ${
                    avatar === p ? 'ring-[#00a884] scale-110' : 'ring-transparent opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#00a884] mb-1">
              Username
            </label>
            <div className="bg-[#f0f2f5] dark:bg-[#111b21] rounded-lg px-3 py-2 text-xs text-[#8696a0] font-mono">
              @{currentUser.username} (tidak dapat diubah)
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#00a884] mb-1">
              Nama Tampilan
            </label>
            <div className="flex items-center bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg px-3 py-2 text-sm">
              <User className="w-4 h-4 text-[#8696a0] mr-2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent outline-none text-[#111b21] dark:text-[#e9edef]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#00a884] mb-1">
              Info Status / Bio
            </label>
            <div className="flex items-center bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg px-3 py-2 text-sm">
              <FileText className="w-4 h-4 text-[#8696a0] mr-2" />
              <input
                type="text"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                className="w-full bg-transparent outline-none text-[#111b21] dark:text-[#e9edef]"
              />
            </div>
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-[#e9edef] dark:border-[#222e35] text-xs font-semibold text-[#8696a0] hover:bg-black/5 dark:hover:bg-white/5"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold flex items-center justify-center space-x-1.5 shadow disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
