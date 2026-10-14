'use client';

import React, { useState } from 'react';
import { ContactItem, UserAccount } from '../types/chat';
import {
  X,
  Phone,
  Video,
  MessageSquare,
  Copy,
  Check,
  Shield,
  AtSign,
  Info,
  Calendar,
  ZoomIn,
} from 'lucide-react';

interface UserProfileModalProps {
  user: ContactItem | UserAccount;
  currentUserId: string;
  onClose: () => void;
  onStartChat?: (user: ContactItem | UserAccount) => void;
  onStartCall?: (type: 'audio' | 'video', targetUser: ContactItem | UserAccount) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  currentUserId,
  onClose,
  onStartChat,
  onStartCall,
}) => {
  const [copiedUsn, setCopiedUsn] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [showFullPhoto, setShowFullPhoto] = useState(false);

  const username = user.username || (user as any).identifier?.split('@')[0] || user.id.slice(0, 8);
  const phone = user.phone || (user as any).identifier || '-';
  const about = user.about || 'Ada';
  const isOnline = user.isOnline;
  const lastSeen = user.lastSeen || (isOnline ? 'online' : 'terakhir dilihat baru-baru ini');

  const handleCopyUsername = () => {
    if (!username) return;
    navigator.clipboard.writeText(`@${username}`);
    setCopiedUsn(true);
    setTimeout(() => setCopiedUsn(false), 2000);
  };

  const handleCopyPhone = () => {
    if (!phone || phone === '-') return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 animate-fade-in select-none">
        <div className="bg-[#f0f2f5] dark:bg-[#111b21] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-[#e9edef] dark:border-[#222e35] flex flex-col max-h-[92dvh]">
          {/* Header */}
          <div className="h-14 px-5 bg-[#008069] dark:bg-[#1f2c34] text-white flex items-center justify-between flex-shrink-0">
            <span className="font-semibold text-sm">Info Kontak</span>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/10 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Hero Section */}
            <div className="p-6 bg-white dark:bg-[#111b21] flex flex-col items-center border-b border-[#e9edef] dark:border-[#222e35]">
              <div
                onClick={() => setShowFullPhoto(true)}
                className="relative group cursor-pointer"
                title="Klik untuk melihat foto ukuran penuh"
              >
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-28 h-28 rounded-full object-cover ring-4 ring-[#00a884]/30 shadow-md group-hover:brightness-90 transition-all"
                />
                <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                  <ZoomIn className="w-6 h-6" />
                </div>
              </div>

              <h2 className="mt-4 text-xl font-bold text-[#111b21] dark:text-[#e9edef] text-center">
                {user.name}
              </h2>

              {/* Username Pill */}
              <div className="mt-1 flex items-center space-x-1.5">
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e7fce3] dark:bg-[#00a884]/20 text-[#00a884]">
                  <AtSign className="w-3 h-3 mr-0.5" />
                  <span>{username}</span>
                </span>
                <button
                  onClick={handleCopyUsername}
                  className="p-1 text-[#8696a0] hover:text-[#00a884] transition-colors rounded"
                  title="Salin username"
                >
                  {copiedUsn ? <Check className="w-3.5 h-3.5 text-[#00a884]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Status Online */}
              <div className="mt-2 text-xs flex items-center space-x-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-[#00a884] animate-pulse' : 'bg-[#8696a0]'
                  }`}
                />
                <span className="text-[#667781] dark:text-[#8696a0]">
                  {isOnline ? 'Online' : lastSeen}
                </span>
              </div>

              {/* Quick Actions (Call, Video, Chat) */}
              {user.id !== currentUserId && (
                <div className="mt-6 flex items-center justify-center space-x-4 w-full">
                  <button
                    onClick={() => {
                      onStartChat?.(user);
                      onClose();
                    }}
                    className="flex flex-col items-center justify-center w-20 py-2 rounded-xl bg-[#f0f2f5] dark:bg-[#202c33] hover:bg-[#e9edef] dark:hover:bg-[#2a3942] text-[#00a884] transition-colors"
                  >
                    <MessageSquare className="w-5 h-5 mb-1" />
                    <span className="text-[11px] font-medium text-[#111b21] dark:text-[#e9edef]">Pesan</span>
                  </button>

                  {onStartCall && (
                    <>
                      <button
                        onClick={() => {
                          onStartCall('audio', user);
                          onClose();
                        }}
                        className="flex flex-col items-center justify-center w-20 py-2 rounded-xl bg-[#f0f2f5] dark:bg-[#202c33] hover:bg-[#e9edef] dark:hover:bg-[#2a3942] text-[#00a884] transition-colors"
                      >
                        <Phone className="w-5 h-5 mb-1" />
                        <span className="text-[11px] font-medium text-[#111b21] dark:text-[#e9edef]">Audio</span>
                      </button>

                      <button
                        onClick={() => {
                          onStartCall('video', user);
                          onClose();
                        }}
                        className="flex flex-col items-center justify-center w-20 py-2 rounded-xl bg-[#f0f2f5] dark:bg-[#202c33] hover:bg-[#e9edef] dark:hover:bg-[#2a3942] text-[#00a884] transition-colors"
                      >
                        <Video className="w-5 h-5 mb-1" />
                        <span className="text-[11px] font-medium text-[#111b21] dark:text-[#e9edef]">Video</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Info / About Card */}
            <div className="p-4 bg-white dark:bg-[#111b21] mt-2.5 border-y border-[#e9edef] dark:border-[#222e35] space-y-4">
              <div>
                <span className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">
                  Info / Status
                </span>
                <div className="mt-1 flex items-start space-x-2">
                  <Info className="w-4 h-4 text-[#00a884] mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium text-[#111b21] dark:text-[#e9edef] break-words">
                    {about}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#f0f2f5] dark:border-[#202c33]">
                <span className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">
                  Nomor Telepon / Kontak
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-[#111b21] dark:text-[#e9edef]">
                    {phone}
                  </span>
                  {phone !== '-' && (
                    <button
                      onClick={handleCopyPhone}
                      className="p-1 text-[#8696a0] hover:text-[#00a884] transition-colors"
                      title="Salin nomor"
                    >
                      {copiedPhone ? (
                        <Check className="w-3.5 h-3.5 text-[#00a884]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {(user as any).createdAt && (
                <div className="pt-3 border-t border-[#f0f2f5] dark:border-[#202c33] flex items-center space-x-2 text-xs text-[#8696a0]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Bergabung sejak{' '}
                    {new Date((user as any).createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Security Notice */}
            <div className="p-4 bg-white dark:bg-[#111b21] mt-2.5 border-y border-[#e9edef] dark:border-[#222e35] flex items-center space-x-3">
              <Shield className="w-5 h-5 text-[#00a884] flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[#111b21] dark:text-[#e9edef]">
                  Enkripsi End-to-End
                </p>
                <p className="text-[11px] text-[#8696a0]">
                  Pesan dan panggilan Anda diamankan langsung antara Anda dan kontak ini.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Photo Lightbox */}
      {showFullPhoto && (
        <div
          onClick={() => setShowFullPhoto(false)}
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4 animate-fade-in"
        >
          <button
            onClick={() => setShowFullPhoto(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={user.avatar}
            alt={user.name}
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl ring-2 ring-white/20"
          />
          <div className="mt-4 text-center text-white">
            <h3 className="font-semibold text-lg">{user.name}</h3>
            {username && <p className="text-sm text-[#00a884]">@{username}</p>}
          </div>
        </div>
      )}
    </>
  );
};
