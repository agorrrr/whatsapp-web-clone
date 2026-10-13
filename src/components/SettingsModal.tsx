'use client';

import React, { useState } from 'react';
import { UserProfile } from '../types/chat';
import { X, Camera, Moon, Sun, RotateCcw, Check } from 'lucide-react';

interface SettingsModalProps {
  currentUser: UserProfile;
  theme: 'dark' | 'light';
  onUpdateUser: (user: UserProfile) => void;
  onToggleTheme: () => void;
  onResetData: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  theme,
  onUpdateUser,
  onToggleTheme,
  onResetData,
  onClose,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [about, setAbout] = useState(currentUser.about);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    onUpdateUser({
      ...currentUser,
      name,
      about,
      avatar,
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-[#e9edef] dark:border-[#222e35]">
        {/* Header */}
        <div className="h-14 px-4 bg-[#008069] dark:bg-[#202c33] text-white flex items-center justify-between border-b border-transparent dark:border-[#222e35]">
          <span className="font-semibold text-base">Pengaturan Profil</span>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center space-y-5">
          {/* Avatar with upload */}
          <div className="relative group cursor-pointer">
            <img
              src={avatar}
              alt="Avatar"
              className="w-28 h-28 rounded-full object-cover ring-4 ring-[#00a884]/30"
            />
            <label className="absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera className="w-6 h-6 mb-1" />
              <span className="text-[10px] uppercase font-bold">Ubah Foto</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </label>
          </div>

          {/* Form fields */}
          <div className="w-full space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#00a884] mb-1">
                Nama Anda
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#f0f2f5] dark:bg-[#2a3942] border border-transparent focus:border-[#00a884] rounded-lg px-3 py-2 text-sm text-[#111b21] dark:text-[#e9edef] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#00a884] mb-1">
                Info (Status)
              </label>
              <input
                type="text"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                className="w-full bg-[#f0f2f5] dark:bg-[#2a3942] border border-transparent focus:border-[#00a884] rounded-lg px-3 py-2 text-sm text-[#111b21] dark:text-[#e9edef] outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#e9edef] dark:border-[#222e35]">
              <span className="text-sm text-[#111b21] dark:text-[#e9edef]">Tema Tampilan</span>
              <button
                onClick={onToggleTheme}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-xs font-medium text-[#111b21] dark:text-[#e9edef]"
              >
                {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                <span>{theme === 'dark' ? 'Mode Gelap' : 'Mode Terang'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#667781] dark:text-[#8696a0]">Reset Chat Demo</span>
              <button
                onClick={onResetData}
                className="flex items-center space-x-1 px-3 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ke Default</span>
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="w-full flex space-x-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-[#e9edef] dark:border-[#222e35] text-sm text-[#667781] dark:text-[#8696a0] hover:bg-black/5 dark:hover:bg-white/5"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2 rounded-lg bg-[#00a884] hover:bg-[#008f70] text-white text-sm font-semibold flex items-center justify-center space-x-1 shadow"
            >
              {isSaved ? <Check className="w-4 h-4" /> : <span>Simpan</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
