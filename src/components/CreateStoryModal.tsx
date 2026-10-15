'use client';

import React, { useState, useRef } from 'react';
import { UserAccount, StoryItem } from '../types/chat';
import { X, Image as ImageIcon, Type, Sparkles, Send, UploadCloud, Check } from 'lucide-react';

interface CreateStoryModalProps {
  currentUser: UserAccount;
  onClose: () => void;
  onStoryCreated: (story: StoryItem) => void;
}

const BG_COLORS = [
  '#075e54', // WhatsApp Teal
  '#005c4b', // Dark Teal
  '#6a1b9a', // Deep Purple
  '#ad1457', // Magenta / Pink
  '#b71c1c', // Crimson Red
  '#d84315', // Rust Orange
  '#1565c0', // Royal Blue
  '#263238', // Charcoal
];

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  currentUser,
  onClose,
  onStoryCreated,
}) => {
  const [tab, setTab] = useState<'image' | 'text'>('image');
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // File upload to Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Pilih file gambar valid (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('Ukuran file maksimal 15MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawData = reader.result as string;
      // Auto compress image to max 1280px dimension to prevent Vercel 4.5MB payload limit
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1280;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setImageUrl(compressedDataUrl);
        } else {
          setImageUrl(rawData);
        }
        setErrorMsg('');
      };
      img.onerror = () => {
        setImageUrl(rawData);
        setErrorMsg('');
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (tab === 'image' && !imageUrl.trim()) {
      setErrorMsg('Silakan pilih foto atau gambar terlebih dahulu.');
      return;
    }

    if (tab === 'text' && !textContent.trim()) {
      setErrorMsg('Tulis teks status Anda terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          type: tab,
          mediaUrl: tab === 'image' ? imageUrl : undefined,
          caption: tab === 'image' ? caption.trim() : undefined,
          text: tab === 'text' ? textContent.trim() : undefined,
          backgroundColor: tab === 'text' ? selectedBg : undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.story) {
        onStoryCreated(data.story);
        onClose();
      } else {
        setErrorMsg(data.message || 'Gagal membuat status.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Koneksi gagal saat membuat status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-[#111b21] border border-[#2a3942] rounded-2xl overflow-hidden shadow-2xl flex flex-col text-white animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2a3942] flex items-center justify-between bg-[#202c33]">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-[#00a884]" />
            <h3 className="font-semibold text-base text-[#e9edef]">Buat Status Baru</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#8696a0] hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher: Foto vs Teks */}
        <div className="flex border-b border-[#2a3942] bg-[#111b21]">
          <button
            type="button"
            onClick={() => setTab('image')}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center space-x-2 border-b-2 transition ${
              tab === 'image'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#8696a0] hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Foto / Gambar</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('text')}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center space-x-2 border-b-2 transition ${
              tab === 'text'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#8696a0] hover:text-white'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Teks Berwarna</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {tab === 'image' ? (
            /* IMAGE STORY MODE */
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {imageUrl ? (
                <div className="relative w-full h-56 rounded-xl overflow-hidden bg-black flex items-center justify-center border border-[#2a3942]">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black text-white transition"
                    title="Ganti foto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-52 rounded-xl border-2 border-dashed border-[#2a3942] hover:border-[#00a884] bg-[#202c33]/50 flex flex-col items-center justify-center cursor-pointer transition p-4 text-center group"
                >
                  <div className="w-12 h-12 rounded-full bg-[#00a884]/20 flex items-center justify-center text-[#00a884] mb-2 group-hover:scale-110 transition">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium text-[#e9edef]">Klik untuk pilih foto</p>
                  <p className="text-xs text-[#8696a0] mt-1">Mendukung format JPG, PNG, WebP</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#8696a0] mb-1.5">
                  Keterangan Foto (Opsional)
                </label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Tambahkan keterangan foto..."
                  className="w-full bg-[#202c33] border border-[#2a3942] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                  maxLength={160}
                />
              </div>
            </div>
          ) : (
            /* TEXT STORY MODE */
            <div className="space-y-4">
              {/* Color Palette Selector */}
              <div>
                <label className="block text-xs font-medium text-[#8696a0] mb-2">
                  Pilih Warna Latar
                </label>
                <div className="flex items-center space-x-2 overflow-x-auto py-1">
                  {BG_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedBg(color)}
                      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition shadow"
                      style={{
                        backgroundColor: color,
                        outline: selectedBg === color ? '3px solid white' : 'none',
                      }}
                    >
                      {selectedBg === color && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Canvas Preview */}
              <div
                className="w-full h-52 rounded-xl flex items-center justify-center p-6 text-center transition-colors shadow-inner"
                style={{ backgroundColor: selectedBg }}
              >
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Ketik status teks Anda di sini..."
                  rows={4}
                  className="w-full bg-transparent text-white placeholder-white/60 text-lg md:text-xl font-bold text-center resize-none focus:outline-none drop-shadow"
                  maxLength={200}
                />
              </div>
              <p className="text-right text-[11px] text-[#8696a0]">
                {textContent.length}/200 karakter
              </p>
            </div>
          )}

          {/* 24-Hour Expiration Info Notice */}
          <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-[#202c33] border border-[#2a3942] text-[11px] text-[#8696a0]">
            <span className="w-2 h-2 rounded-full bg-[#00a884] flex-shrink-0 animate-pulse"></span>
            <span>Status Anda otomatis hilang setelah 1x24 jam.</span>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-[#ea0038]/15 border border-[#ea0038]/40 text-xs text-[#ea0038] text-center font-medium">
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#8696a0] hover:bg-[#202c33] hover:text-white transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#00a884] hover:bg-[#008f70] text-white flex items-center space-x-2 transition shadow-lg disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Memublikasikan...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Status</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
