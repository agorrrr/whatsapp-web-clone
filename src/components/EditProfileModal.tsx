'use client';

import React, { useState, useRef } from 'react';
import { UserAccount } from '../types/chat';
import { X, Camera, Check, User, FileText, Upload, Smartphone, ArrowRight } from 'lucide-react';

interface EditProfileModalProps {
  currentUser: UserAccount;
  onUpdateSuccess: (updated: UserAccount) => void;
  onClose: () => void;
  onOpenSyncRealWa?: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  currentUser,
  onUpdateSuccess,
  onClose,
  onOpenSyncRealWa,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [about, setAbout] = useState(currentUser.about || 'Ada di Ini Bukan Whatsapp');
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Compress and resize image to fit efficiently into JSON payload
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setAvatar(compressedDataUrl);
        }
      };
      if (typeof event.target?.result === 'string') {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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
          <span className="font-semibold text-base">Ubah Foto Profil & Nama</span>
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
          {/* Own Photo Upload */}
          <div className="flex flex-col items-center">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative group cursor-pointer"
              title="Klik untuk memilih foto dari galeri/perangkat"
            >
              <img
                src={avatar}
                alt="Foto Profil"
                className="w-28 h-28 rounded-full object-cover ring-4 ring-[#00a884]/40 shadow-md"
              />
              <div className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-7 h-7 mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Ubah Foto</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 px-3.5 py-1.5 rounded-lg bg-[#00a884]/10 hover:bg-[#00a884]/20 text-[#00a884] dark:text-[#25d366] text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Pilih Foto dari Galeri / Ponsel</span>
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFile}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#00a884] mb-1">
              Username
            </label>
            <div className="bg-[#f0f2f5] dark:bg-[#111b21] rounded-lg px-3 py-2 text-xs text-[#8696a0] font-mono">
              @{currentUser.username} (ID akun permanen)
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#00a884] mb-1">
              Nama Lengkap / Tampilan
            </label>
            <div className="flex items-center bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg px-3 py-2 text-sm">
              <User className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
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
              <FileText className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
              <input
                type="text"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                className="w-full bg-transparent outline-none text-[#111b21] dark:text-[#e9edef]"
              />
            </div>
          </div>

          {/* Sync to Real WhatsApp Banner */}
          {onOpenSyncRealWa && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-[#008069]/15 to-[#25d366]/20 border border-[#00a884]/40 flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0 pr-2">
                <div className="w-8 h-8 rounded-full bg-[#25d366] text-white flex items-center justify-center flex-shrink-0 shadow">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-[#111b21] dark:text-[#e9edef] truncate">
                    Sinkronkan ke WhatsApp Asli
                  </h4>
                  <p className="text-[11px] text-[#54656f] dark:text-[#8696a0] truncate">
                    Scan QR / Pairing Code via Baileys
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSyncRealWa();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold flex items-center space-x-1 shadow-xs flex-shrink-0 transition-colors"
              >
                <span>Buka</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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
              <span>{loading ? 'Menyimpan...' : 'Simpan Profil'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
