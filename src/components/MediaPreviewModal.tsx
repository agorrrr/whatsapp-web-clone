'use client';

import React, { useState } from 'react';
import { X, Send, Smile } from 'lucide-react';

interface MediaPreviewModalProps {
  imageUrl: string;
  onClose: () => void;
  onSend: (imageUrl: string, caption: string) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  imageUrl,
  onClose,
  onSend,
}) => {
  const [caption, setCaption] = useState('');

  const handleSend = () => {
    onSend(imageUrl, caption);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#111b21]/95 backdrop-blur-sm text-white">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#202c33]/50">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
          title="Tutup"
        >
          <X className="w-6 h-6" />
        </button>
        <span className="font-medium text-sm text-neutral-200">Kirim Foto</span>
        <div className="w-8" />
      </div>

      {/* Middle Image Viewer */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <img
          src={imageUrl}
          alt="Preview"
          className="max-h-[70vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* Bottom Caption & Send Bar */}
      <div className="p-4 bg-[#202c33] flex items-center space-x-3 max-w-4xl w-full mx-auto rounded-t-xl">
        <div className="flex-1 flex items-center bg-[#2a3942] rounded-lg px-4 py-2 text-white">
          <Smile className="w-5 h-5 text-neutral-400 mr-2 flex-shrink-0 cursor-pointer" />
          <input
            type="text"
            placeholder="Tambah keterangan..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full bg-transparent outline-none text-sm text-white placeholder-neutral-400"
          />
        </div>

        <button
          onClick={handleSend}
          className="w-12 h-12 rounded-full bg-[#00a884] hover:bg-[#008f70] text-white flex items-center justify-center transition-transform hover:scale-105 shadow-lg flex-shrink-0"
          title="Kirim"
        >
          <Send className="w-5 h-5 ml-0.5 fill-current" />
        </button>
      </div>
    </div>
  );
};
