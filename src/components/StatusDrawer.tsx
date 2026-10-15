'use client';

import React from 'react';
import { UserAccount, StoryItem, UserStoryGroup } from '../types/chat';
import { ArrowLeft, Plus, Eye, Sparkles } from 'lucide-react';

interface StatusDrawerProps {
  currentUser: UserAccount;
  myStories: StoryItem[];
  friendStories: UserStoryGroup[];
  onClose: () => void;
  onOpenCreateStory: () => void;
  onViewStoryGroup: (group: UserStoryGroup) => void;
}

export const StatusDrawer: React.FC<StatusDrawerProps> = ({
  currentUser,
  myStories,
  friendStories,
  onClose,
  onOpenCreateStory,
  onViewStoryGroup,
}) => {
  const hasMyStories = myStories.length > 0;
  const unviewedFriends = friendStories.filter((f) => f.hasUnviewed);
  const viewedFriends = friendStories.filter((f) => !f.hasUnviewed);

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit yang lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam yang lalu`;
    return 'Kemarin';
  };

  const handleMyStatusClick = () => {
    if (hasMyStories) {
      onViewStoryGroup({
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        isSelf: true,
        stories: myStories,
        latestTimestamp: Math.max(...myStories.map((s) => s.createdAt)),
      });
    } else {
      onOpenCreateStory();
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#111b21] select-none z-20 animate-in slide-in-from-left duration-200">
      {/* Header */}
      <div className="h-16 px-4 bg-[#008069] dark:bg-[#202c33] flex items-center space-x-4 text-white shadow-md flex-shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition"
          title="Kembali ke chat"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-lg text-white">Status</h2>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-[#e9edef] dark:divide-[#222e35]">
        {/* Status Saya Section */}
        <div className="p-4 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]/50 transition cursor-pointer flex items-center justify-between">
          <div onClick={handleMyStatusClick} className="flex items-center space-x-3.5 flex-1 min-w-0">
            <div className="relative flex-shrink-0">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className={`w-12 h-12 rounded-full object-cover ${
                  hasMyStories ? 'ring-2 ring-[#00a884] ring-offset-2 dark:ring-offset-[#111b21]' : ''
                }`}
              />
              {!hasMyStories && (
                <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#00a884] flex items-center justify-center text-white border-2 border-white dark:border-[#111b21]">
                  <Plus className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-[#111b21] dark:text-[#e9edef]">Status saya</h3>
              <p className="text-xs text-[#667781] dark:text-[#8696a0] truncate mt-0.5">
                {hasMyStories
                  ? `${myStories.length} status aktif · ${formatTimeAgo(myStories[0].createdAt)}`
                  : 'Klik untuk menambahkan pembaruan status'}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenCreateStory}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#00a884] transition"
            title="Tambah status baru"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Pembaruan Terkini (Unviewed Stories) */}
        {unviewedFriends.length > 0 && (
          <div className="py-3">
            <div className="px-4 pb-2 text-[11px] font-semibold text-[#00a884] uppercase tracking-wider">
              Pembaruan Terkini
            </div>
            <div className="space-y-0.5">
              {unviewedFriends.map((group) => (
                <div
                  key={group.userId}
                  onClick={() => onViewStoryGroup(group)}
                  className="px-4 py-2.5 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]/50 transition cursor-pointer flex items-center space-x-3.5"
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={group.userAvatar}
                      alt={group.userName}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-[#00a884] ring-offset-2 dark:ring-offset-[#111b21]"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm text-[#111b21] dark:text-[#e9edef] truncate">
                      {group.userName}
                    </h4>
                    <p className="text-xs text-[#667781] dark:text-[#8696a0] mt-0.5">
                      {formatTimeAgo(group.latestTimestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pembaruan yang Telah Dilihat (Viewed Stories) */}
        {viewedFriends.length > 0 && (
          <div className="py-3">
            <div className="px-4 pb-2 text-[11px] font-semibold text-[#667781] dark:text-[#8696a0] uppercase tracking-wider">
              Pembaruan yang Telah Dilihat
            </div>
            <div className="space-y-0.5">
              {viewedFriends.map((group) => (
                <div
                  key={group.userId}
                  onClick={() => onViewStoryGroup(group)}
                  className="px-4 py-2.5 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]/50 transition cursor-pointer flex items-center space-x-3.5 opacity-80 hover:opacity-100"
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={group.userAvatar}
                      alt={group.userName}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-[#8696a0]/40 ring-offset-2 dark:ring-offset-[#111b21]"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm text-[#111b21] dark:text-[#e9edef] truncate">
                      {group.userName}
                    </h4>
                    <p className="text-xs text-[#667781] dark:text-[#8696a0] mt-0.5">
                      {formatTimeAgo(group.latestTimestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {friendStories.length === 0 && !hasMyStories && (
          <div className="p-8 text-center flex flex-col items-center justify-center text-[#667781] dark:text-[#8696a0]">
            <div className="w-14 h-14 rounded-full bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-center text-[#00a884] mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-[#111b21] dark:text-[#e9edef]">Belum ada status</p>
            <p className="text-xs mt-1 max-w-xs">
              Bagikan status foto atau teks ke teman-teman Anda. Status akan otomatis terhapus setelah 1x24 jam.
            </p>
            <button
              onClick={onOpenCreateStory}
              className="mt-4 px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold shadow transition"
            >
              Buat Status Sekarang
            </button>
          </div>
        )}
      </div>

      {/* Expiration Note Footer */}
      <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#222e35] text-center text-[11px] text-[#667781] dark:text-[#8696a0]">
        Status Anda terenkripsi end-to-end dan hilang otomatis setelah 24 jam.
      </div>
    </div>
  );
};
