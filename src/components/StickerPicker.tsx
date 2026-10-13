'use client';

import React, { useState } from 'react';
import { PRESET_STICKERS, POPULAR_EMOJIS } from '../utils/mockData';
import { Smile, Sticker as StickerIcon, Search } from 'lucide-react';

interface StickerPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (stickerUrl: string) => void;
  onClose: () => void;
}

export const StickerPicker: React.FC<StickerPickerProps> = ({
  onSelectEmoji,
  onSelectSticker,
}) => {
  const [activeTab, setActiveTab] = useState<'emoji' | 'sticker'>('emoji');
  const [searchFilter, setSearchFilter] = useState('');

  const filteredEmojis = searchFilter
    ? POPULAR_EMOJIS.filter((e) => e.includes(searchFilter))
    : POPULAR_EMOJIS;

  const filteredStickers = searchFilter
    ? PRESET_STICKERS.filter((s) => s.name.toLowerCase().includes(searchFilter.toLowerCase()))
    : PRESET_STICKERS;

  return (
    <div className="h-64 flex flex-col bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#222e35] select-none">
      {/* Top Tabs */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1 border-b border-[#e9edef] dark:border-[#222e35]">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('emoji')}
            className={`flex items-center space-x-1 pb-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'emoji'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#667781] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#e9edef]'
            }`}
          >
            <Smile className="w-4 h-4" />
            <span>Emoji</span>
          </button>
          <button
            onClick={() => setActiveTab('sticker')}
            className={`flex items-center space-x-1 pb-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sticker'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#667781] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#e9edef]'
            }`}
          >
            <StickerIcon className="w-4 h-4" />
            <span>Stiker</span>
          </button>
        </div>

        {/* Search bar inside picker */}
        <div className="flex items-center bg-white dark:bg-[#111b21] rounded-full px-2.5 py-1 text-xs w-40">
          <Search className="w-3.5 h-3.5 text-[#667781] dark:text-[#8696a0] mr-1.5" />
          <input
            type="text"
            placeholder="Cari..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-transparent outline-none text-[#111b21] dark:text-[#e9edef]"
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'emoji' ? (
          <div className="grid grid-cols-10 sm:grid-cols-14 md:grid-cols-16 gap-2">
            {filteredEmojis.map((emoji, idx) => (
              <button
                key={idx}
                onClick={() => onSelectEmoji(emoji)}
                className="text-2xl hover:bg-black/10 dark:hover:bg-white/10 rounded p-1 transition-transform hover:scale-125 flex items-center justify-center"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {filteredStickers.map((sticker) => (
              <button
                key={sticker.id}
                onClick={() => onSelectSticker(sticker.url)}
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 flex flex-col items-center justify-center hover:scale-105 transition-all"
                title={sticker.name}
              >
                <img
                  src={sticker.url}
                  alt={sticker.name}
                  className="w-16 h-16 object-contain filter drop-shadow-sm"
                />
                <span className="text-[10px] text-[#667781] dark:text-[#8696a0] mt-1 truncate max-w-full">
                  {sticker.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
