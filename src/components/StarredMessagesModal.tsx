'use client';

import React, { useState, useEffect } from 'react';
import { Message } from '../types/chat';
import { Star, X, MapPin, FileText, Image as ImageIcon, Mic, CornerDownRight } from 'lucide-react';

interface StarredMessagesModalProps {
  userId: string;
  onClose: () => void;
  onSelectChat?: (chatId: string) => void;
  onUnstarSuccess?: (messageId: string) => void;
}

export const StarredMessagesModal: React.FC<StarredMessagesModalProps> = ({
  userId,
  onClose,
  onSelectChat,
  onUnstarSuccess,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStarred = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/messages/starred?userId=${userId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.starredMessages)) {
        setMessages(data.starredMessages);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchStarred();
  }, [userId]);

  const handleUnstar = async (e: React.MouseEvent, messageId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/messages/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, userId }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        onUnstarSuccess?.(messageId);
      }
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#202c33] rounded-2xl w-full max-w-lg shadow-2xl border border-[#e9edef] dark:border-[#2a3942] flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="h-16 px-5 border-b border-[#e9edef] dark:border-[#2a3942] flex items-center justify-between flex-shrink-0 bg-[#f0f2f5] dark:bg-[#182229]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-amber-400/20 text-amber-500 flex items-center justify-center">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#111b21] dark:text-[#e9edef]">
                Pesan Berbintang
              </h2>
              <p className="text-xs text-[#667781] dark:text-[#8696a0]">
                {messages.length} pesan ditandai
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#54656f] dark:text-[#8696a0]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-16 text-center text-sm text-[#8696a0]">
              Memuat pesan berbintang...
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-amber-400/10 text-amber-400 flex items-center justify-center mb-3">
                <Star className="w-8 h-8 stroke-1" />
              </div>
              <p className="text-sm font-semibold text-[#111b21] dark:text-[#e9edef]">
                Belum ada pesan berbintang
              </p>
              <p className="text-xs text-[#8696a0] max-w-xs mt-1">
                Arahkan kursor atau tahan pesan dalam obrolan lalu klik ikon bintang untuk menandai pesan penting.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => {
                  if (onSelectChat) {
                    onSelectChat(msg.chatId);
                    onClose();
                  }
                }}
                className="group relative bg-[#f8f9fa] dark:bg-[#111b21] hover:bg-emerald-500/5 dark:hover:bg-[#233138] border border-[#e9edef] dark:border-[#222e35] rounded-xl p-3.5 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[#00a884] truncate">
                    {msg.senderName || 'Pengguna'}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-[#8696a0]">{msg.timestamp}</span>
                    <button
                      onClick={(e) => handleUnstar(e, msg.id)}
                      title="Hapus dari berbintang"
                      className="p-1 rounded-full text-amber-400 hover:bg-amber-400/10 transition-colors"
                    >
                      <Star className="w-4 h-4 fill-amber-400" />
                    </button>
                  </div>
                </div>

                {/* Content preview */}
                <div className="text-sm text-[#111b21] dark:text-[#e9edef] leading-relaxed">
                  {msg.type === 'text' && <p className="line-clamp-3">{msg.text}</p>}

                  {msg.type === 'location' && (
                    <div className="flex items-center space-x-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span>Lokasi: {msg.locationInfo?.address || 'Titik GPS'}</span>
                    </div>
                  )}

                  {msg.type === 'document' && (
                    <div className="flex items-center space-x-2 text-xs text-blue-500 font-medium">
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{msg.fileName || 'Dokumen berkas'}</span>
                    </div>
                  )}

                  {msg.type === 'image' && (
                    <div className="flex items-center space-x-2 text-xs text-purple-500 font-medium">
                      <ImageIcon className="w-4 h-4 flex-shrink-0" />
                      <span>{msg.text || 'Foto / Gambar'}</span>
                    </div>
                  )}

                  {msg.type === 'audio' && (
                    <div className="flex items-center space-x-2 text-xs text-[#00a884] font-medium">
                      <Mic className="w-4 h-4 flex-shrink-0" />
                      <span>Pesan Suara</span>
                    </div>
                  )}
                </div>

                {/* Jump to chat indicator */}
                <div className="mt-2 pt-2 border-t border-[#e9edef]/60 dark:border-[#222e35]/60 flex items-center justify-between text-[11px] text-[#8696a0]">
                  <span>Klik untuk buka obrolan</span>
                  <CornerDownRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-[#00a884]" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
