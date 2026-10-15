'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ContactItem, Message, MessageType } from '../types/chat';
import { MessageBubble } from './MessageBubble';
import { AudioRecorder } from './AudioRecorder';
import { StickerPicker } from './StickerPicker';
import { MediaPreviewModal } from './MediaPreviewModal';
import { CameraCaptureModal } from './CameraCaptureModal';
import {
  Smile,
  Paperclip,
  Mic,
  Send,
  MoreVertical,
  Search,
  ArrowLeft,
  Image as ImageIcon,
  Camera,
  X,
  Lock,
  Phone,
  Video,
  FileText,
  MapPin,
} from 'lucide-react';

interface ChatWindowProps {
  contact: ContactItem;
  currentUserId: string;
  currentUserName?: string;
  messages: Message[];
  onSendMessage: (params: {
    type: MessageType;
    text?: string;
    mediaUrl?: string;
    fileName?: string;
    fileSize?: string;
    audioDuration?: number;
    locationInfo?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    replyTo?: Message;
  }) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onClearChat: () => void;
  onDeleteMessage?: (messageId: string) => void;
  onToggleStar?: (messageId: string) => void;
  onBackMobile?: () => void;
  onOpenGroupInfo?: () => void;
  onOpenProfile?: (contact: ContactItem) => void;
  onSenderClick?: (senderId: string) => void;
  onStartCall?: (type: 'audio' | 'video') => void;
  theme: 'dark' | 'light';
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  contact,
  currentUserId,
  currentUserName,
  messages,
  onSendMessage,
  onReaction,
  onClearChat,
  onDeleteMessage,
  onToggleStar,
  onBackMobile,
  onOpenGroupInfo,
  onOpenProfile,
  onSenderClick,
  onStartCall,
  theme,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [replyingMessage, setReplyingMessage] = useState<Message | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const notifyTyping = (isTyping: boolean) => {
    fetch('/api/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: contact.id,
        userId: currentUserId,
        userName: currentUserName || 'Teman',
        isTyping,
      }),
    }).catch(() => {});
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    const now = Date.now();
    if (val.trim().length > 0) {
      if (now - lastTypingSentRef.current > 2000) {
        lastTypingSentRef.current = now;
        notifyTyping(true);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        notifyTyping(false);
      }, 3000);
    } else {
      notifyTyping(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendText = () => {
    if (!inputText.trim()) return;
    notifyTyping(false);
    onSendMessage({
      type: 'text',
      text: inputText.trim(),
      replyTo: replyingMessage || undefined,
    });
    setInputText('');
    setReplyingMessage(null);
    setShowStickerPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPreviewImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
    setShowAttachmentMenu(false);
  };

  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('Ukuran berkas dokumen maksimal 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const sizeStr =
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`;

      onSendMessage({
        type: 'document',
        mediaUrl: dataUrl,
        fileName: file.name,
        fileSize: sizeStr,
        replyTo: replyingMessage || undefined,
      });
      setReplyingMessage(null);
      setShowAttachmentMenu(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendImage = (url: string, caption: string) => {
    onSendMessage({
      type: 'image',
      mediaUrl: url,
      text: caption,
      replyTo: replyingMessage || undefined,
    });
    setPreviewImage(null);
    setReplyingMessage(null);
  };

  const handleSendAudio = (audioUrl: string, duration: number) => {
    onSendMessage({
      type: 'audio',
      mediaUrl: audioUrl,
      audioDuration: duration,
      replyTo: replyingMessage || undefined,
    });
    setIsRecording(false);
    setReplyingMessage(null);
  };

  const handleSendSticker = (stickerUrl: string) => {
    onSendMessage({
      type: 'sticker',
      mediaUrl: stickerUrl,
      replyTo: replyingMessage || undefined,
    });
    setShowStickerPicker(false);
    setReplyingMessage(null);
  };

  const handleShareLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert('Browser Anda tidak mendukung fitur geolokasi');
      return;
    }
    setShowAttachmentMenu(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onSendMessage({
          type: 'location',
          locationInfo: {
            latitude,
            longitude,
            address: `Lat ${latitude.toFixed(5)}, Lon ${longitude.toFixed(5)}`,
          },
          replyTo: replyingMessage || undefined,
        });
        setReplyingMessage(null);
      },
      (err) => {
        alert(`Gagal mengambil titik lokasi: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a] relative overflow-hidden">
      {/* Top Header */}
      <div className="h-16 px-4 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between border-b border-[#e9edef] dark:border-[#222e35] select-none z-20">
        <div
          onClick={() => {
            if (contact.isGroup) {
              onOpenGroupInfo?.();
            } else {
              onOpenProfile?.(contact);
            }
          }}
          className="flex items-center space-x-3 cursor-pointer hover:opacity-90 transition-opacity"
          title={contact.isGroup ? 'Klik untuk lihat info grup' : 'Klik untuk lihat info profil'}
        >
          {onBackMobile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBackMobile();
              }}
              className="md:hidden p-1 rounded-full text-[#54656f] dark:text-[#aebac1]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <img
            src={contact.avatar}
            alt={contact.name}
            className="w-10 h-10 rounded-full object-cover"
          />

          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-sm text-[#111b21] dark:text-[#e9edef]">
                {contact.name}
              </span>
              {contact.username && (
                <span className="text-xs text-[#00a884] font-medium">
                  @{contact.username}
                </span>
              )}
            </div>
            <span className="text-[11px] text-[#667781] dark:text-[#8696a0]">
              {contact.isGroup ? (
                <span className="text-[#00a884] font-medium">
                  {contact.participantsCount ? `${contact.participantsCount} peserta · ` : ''}Klik untuk info grup
                </span>
              ) : contact.isTyping ? (
                <span className="text-[#00a884] font-medium animate-pulse">sedang mengetik...</span>
              ) : contact.isOnline ? (
                <span className="text-[#00a884]">online</span>
              ) : (
                contact.lastSeen || 'terakhir dilihat baru-baru ini'
              )}
            </span>
          </div>
        </div>

        {/* Right menu actions */}
        <div className="flex items-center space-x-1 sm:space-x-2 text-[#54656f] dark:text-[#aebac1] relative">
          {onStartCall && (
            <>
              <button
                onClick={() => onStartCall('video')}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title={contact.isGroup ? "Panggilan video grup" : "Panggilan video"}
              >
                <Video className="w-5 h-5" />
              </button>
              <button
                onClick={() => onStartCall('audio')}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title={contact.isGroup ? "Panggilan suara grup" : "Panggilan suara"}
              >
                <Phone className="w-5 h-5" />
              </button>
            </>
          )}

          <button
            onClick={() => {
              setShowSearch((s) => !s);
              if (showSearch) setSearchQuery('');
            }}
            className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
              showSearch ? 'text-[#00a884] bg-black/5 dark:bg-white/5' : ''
            }`}
            title="Cari di chat"
          >
            <Search className="w-5 h-5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Menu"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-11 w-44 bg-white dark:bg-[#233138] rounded-xl shadow-xl py-2 z-50 border border-[#e9edef] dark:border-[#2a3942] text-sm text-[#111b21] dark:text-[#d1d7db]">
                {contact.isGroup ? (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onOpenGroupInfo?.();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 text-[#111b21] dark:text-[#e9edef]"
                  >
                    Info grup
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onOpenProfile?.(contact);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 text-[#111b21] dark:text-[#e9edef]"
                  >
                    Info kontak
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onClearChat();
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 text-red-500"
                >
                  Bersihkan pesan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* In-Chat Search Bar */}
      {showSearch && (
        <div className="px-4 py-2.5 bg-[#f0f2f5] dark:bg-[#111b21] border-b border-[#e9edef] dark:border-[#222e35] flex items-center justify-between z-20 shadow-sm animate-fade-in">
          <div className="flex-1 flex items-center bg-white dark:bg-[#202c33] rounded-lg px-3 py-1.5 border border-[#e9edef] dark:border-[#2a3942] mr-3">
            <Search className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pesan di obrolan..."
              className="w-full bg-transparent text-sm text-[#111b21] dark:text-[#e9edef] placeholder-[#8696a0] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#e9edef] ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center space-x-2 text-xs text-[#8696a0]">
            {searchQuery && (
              <span className="font-medium text-[#00a884]">
                {
                  messages.filter(
                    (m) =>
                      (m.text || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (m.fileName || '').toLowerCase().includes(searchQuery.toLowerCase())
                  ).length
                }{' '}
                ditemukan
              </span>
            )}
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#54656f] dark:text-[#aebac1]"
              title="Tutup pencarian"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        className={`flex-1 overflow-y-auto px-4 md:px-12 py-4 ${
          theme === 'dark' ? 'wa-chat-bg-dark' : 'wa-chat-bg-light'
        }`}
      >
        {/* Date separator pill */}
        <div className="flex justify-center mb-4 select-none">
          <span className="bg-white/90 dark:bg-[#182229]/90 text-[11px] text-[#54656f] dark:text-[#8696a0] px-3 py-1 rounded-md shadow-sm uppercase font-semibold">
            Chat Pribadi
          </span>
        </div>

        {/* Security notice */}
        <div className="flex justify-center mb-4 select-none">
          <span className="bg-[#ffeecd] dark:bg-[#182229] border border-[#f0c868]/40 dark:border-neutral-700 text-[11px] text-[#54656f] dark:text-[#ffd279] px-4 py-1.5 rounded-lg shadow-sm text-center max-w-md flex items-center justify-center space-x-1.5">
            <Lock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Pesan antara Anda dan @{contact.username} hanya dapat dibaca oleh Anda berdua.</span>
          </span>
        </div>

        {/* Message bubbles */}
        {(searchQuery.trim()
          ? messages.filter(
              (m) =>
                (m.text || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (m.fileName || '').toLowerCase().includes(searchQuery.toLowerCase())
            )
          : messages
        ).map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isMe={msg.senderId === currentUserId}
            currentUserId={currentUserId}
            onReply={(m) => setReplyingMessage(m)}
            onReaction={onReaction}
            onToggleStar={onToggleStar}
            onImageClick={(url) => setLightboxImage(url)}
            onSenderClick={onSenderClick}
            onDeleteMessage={onDeleteMessage}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Replying banner preview */}
      {replyingMessage && (
        <div className="px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#222e35] flex items-center justify-between z-10">
          <div className="border-l-4 border-[#00a884] pl-2 text-xs">
            <span className="font-semibold text-[#00a884]">
              Membalas {replyingMessage.senderId === currentUserId ? 'Anda' : contact.name}
            </span>
            <p className="text-[#667781] dark:text-[#8696a0] truncate max-w-md">
              {replyingMessage.text || (replyingMessage.type === 'audio' ? 'Pesan suara' : 'Media')}
            </p>
          </div>
          <button
            onClick={() => setReplyingMessage(null)}
            className="p-1 rounded-full text-[#667781] dark:text-[#8696a0] hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input bar / Audio Recording Bar */}
      {isRecording ? (
        <AudioRecorder
          onCancel={() => setIsRecording(false)}
          onSend={handleSendAudio}
        />
      ) : (
        <div className="px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#222e35] flex items-center space-x-2 z-10">
          {/* Emoji / Sticker button */}
          <button
            onClick={() => setShowStickerPicker(!showStickerPicker)}
            className={`p-2 rounded-full transition-colors ${
              showStickerPicker
                ? 'text-[#00a884]'
                : 'text-[#54656f] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#e9edef]'
            }`}
            title="Emoji & Stiker"
          >
            <Smile className="w-6 h-6" />
          </button>

          {/* Attachment button */}
          <div className="relative">
            <button
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="p-2 rounded-full text-[#54656f] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#e9edef] transition-colors"
              title="Kirim Foto"
            >
              <Paperclip className="w-6 h-6 transform -rotate-45" />
            </button>

            {showAttachmentMenu && (
              <div className="absolute bottom-12 left-0 bg-white dark:bg-[#233138] rounded-xl shadow-xl p-3 flex flex-col space-y-2 z-50 border border-[#e9edef] dark:border-[#2a3942] min-w-[180px]">
                <button
                  onClick={() => {
                    setShowAttachmentMenu(false);
                    setShowCamera(true);
                  }}
                  className="flex items-center space-x-3 text-xs font-medium text-[#111b21] dark:text-[#d1d7db] hover:bg-black/5 dark:hover:bg-white/5 p-2 rounded-lg"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span>Akses Kamera</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-3 text-xs font-medium text-[#111b21] dark:text-[#d1d7db] hover:bg-black/5 dark:hover:bg-white/5 p-2 rounded-lg"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span>Foto & Galeri</span>
                </button>

                <button
                  onClick={() => docInputRef.current?.click()}
                  className="flex items-center space-x-3 text-xs font-medium text-[#111b21] dark:text-[#d1d7db] hover:bg-black/5 dark:hover:bg-white/5 p-2 rounded-lg"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-white">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span>Dokumen & Berkas</span>
                </button>

                <button
                  onClick={handleShareLocation}
                  className="flex items-center space-x-3 text-xs font-medium text-[#111b21] dark:text-[#d1d7db] hover:bg-black/5 dark:hover:bg-white/5 p-2 rounded-lg"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-green-600 flex items-center justify-center text-white">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <span>Bagikan Lokasi</span>
                </button>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFileChange}
          />

          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
            className="hidden"
            onChange={handleDocumentFileChange}
          />

          {/* Input text */}
          <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg px-4 py-2.5">
            <input
              type="text"
              placeholder="Ketik pesan pribadi..."
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent outline-none text-sm text-[#111b21] dark:text-[#e9edef] placeholder-[#667781] dark:placeholder-[#8696a0]"
            />
          </div>

          {/* Send text button or Mic button */}
          {inputText.trim().length > 0 ? (
            <button
              onClick={handleSendText}
              className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f70] text-white flex items-center justify-center transition-transform hover:scale-105 shadow-md flex-shrink-0"
              title="Kirim Pesan"
            >
              <Send className="w-5 h-5 ml-0.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={() => setIsRecording(true)}
              className="p-2 rounded-full text-[#54656f] dark:text-[#8696a0] hover:text-[#00a884] hover:scale-110 transition-all flex-shrink-0"
              title="Rekam pesan suara"
            >
              <Mic className="w-6 h-6" />
            </button>
          )}
        </div>
      )}

      {/* Sticker drawer */}
      {showStickerPicker && (
        <StickerPicker
          onSelectEmoji={(emoji) => setInputText((prev) => prev + emoji)}
          onSelectSticker={handleSendSticker}
          onClose={() => setShowStickerPicker(false)}
        />
      )}

      {/* Camera Capture Modal */}
      {showCamera && (
        <CameraCaptureModal
          onCapture={(capturedUrl) => {
            setShowCamera(false);
            setPreviewImage(capturedUrl);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Media preview modal */}
      {previewImage && (
        <MediaPreviewModal
          imageUrl={previewImage}
          onClose={() => setPreviewImage(null)}
          onSend={handleSendImage}
        />
      )}

      {/* Lightbox image */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="Foto"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
