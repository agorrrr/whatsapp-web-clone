'use client';

import React, { useState, useEffect, useRef } from 'react';
import { StoryItem, UserStoryGroup } from '../types/chat';
import { X, ChevronLeft, ChevronRight, Trash2, Eye, Send, Sparkles } from 'lucide-react';

interface StoryViewerModalProps {
  storyGroup: UserStoryGroup;
  currentUserId: string;
  onClose: () => void;
  onNextGroup?: () => void;
  onPrevGroup?: () => void;
  onDeleteStory?: (storyId: string) => void;
  onStoryViewed?: (storyId: string) => void;
  onSendReply?: (recipientId: string, replyText: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  storyGroup,
  currentUserId,
  onClose,
  onNextGroup,
  onPrevGroup,
  onDeleteStory,
  onStoryViewed,
  onSendReply,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplySent, setShowReplySent] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentStory: StoryItem | undefined = storyGroup.stories[currentIndex];
  const isOwner = currentStory?.userId === currentUserId;

  const STORY_DURATION = 5000; // 5 seconds per story

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit yang lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam yang lalu`;
    return 'Kemarin';
  };

  // Mark story as viewed
  useEffect(() => {
    if (currentStory && !isOwner) {
      onStoryViewed?.(currentStory.id);
    }
  }, [currentStory, isOwner, onStoryViewed]);

  // Story progression timer
  useEffect(() => {
    setProgress(0);
    if (isPaused) return;

    const intervalTime = 50; // update progress every 50ms
    const step = (intervalTime / STORY_DURATION) * 100;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Advance to next story
          if (currentIndex < storyGroup.stories.length - 1) {
            setCurrentIndex((i) => i + 1);
            return 0;
          } else {
            // End of this user's stories, go to next group or close
            if (onNextGroup) {
              onNextGroup();
            } else {
              onClose();
            }
            return 100;
          }
        }
        return prev + step;
      });
    }, intervalTime);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isPaused, storyGroup, onNextGroup, onClose]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isInput) return;

      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, storyGroup]);

  const handleNext = () => {
    if (currentIndex < storyGroup.stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else if (onNextGroup) {
      onNextGroup();
      setCurrentIndex(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    } else if (onPrevGroup) {
      onPrevGroup();
      setCurrentIndex(0);
    }
  };

  const handleSendQuickReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !currentStory) return;
    onSendReply?.(currentStory.userId, `[Membalas Status]: ${replyText.trim()}`);
    setReplyText('');
    setShowReplySent(true);
    setTimeout(() => setShowReplySent(false), 2000);
  };

  if (!currentStory) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Background blur backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-3xl pointer-events-none"
        style={{
          backgroundImage:
            currentStory.type === 'image' && currentStory.mediaUrl
              ? `url(${currentStory.mediaUrl})`
              : 'none',
          backgroundColor: currentStory.backgroundColor || '#0b141a',
        }}
      />

      {/* Main Story Container (9:16 aspect ratio on desktop) */}
      <div className="relative w-full h-full md:max-w-md md:h-[90vh] md:rounded-2xl overflow-hidden bg-[#111b21] flex flex-col shadow-2xl border border-white/10 z-10">
        {/* Top Segmented Progress Bar */}
        <div className="absolute top-0 left-0 right-0 p-3 pt-4 flex space-x-1.5 z-30 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          {storyGroup.stories.map((s, idx) => (
            <div key={s.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-75 ease-linear"
                style={{
                  width:
                    idx < currentIndex
                      ? '100%'
                      : idx === currentIndex
                      ? `${progress}%`
                      : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Top Header info & actions */}
        <div className="absolute top-6 left-0 right-0 px-4 py-2 flex items-center justify-between z-30">
          <div className="flex items-center space-x-3">
            <img
              src={storyGroup.userAvatar}
              alt={storyGroup.userName}
              className="w-10 h-10 rounded-full object-cover border-2 border-white/40 shadow-md"
            />
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-white drop-shadow">
                {isOwner ? 'Status Saya' : storyGroup.userName}
              </span>
              <span className="text-xs text-white/80 drop-shadow">
                {formatTimeAgo(currentStory.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isOwner && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteStory?.(currentStory.id);
                  if (storyGroup.stories.length <= 1) {
                    onClose();
                  } else {
                    handleNext();
                  }
                }}
                className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-[#ea0038] transition"
                title="Hapus status ini"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Story Content Area */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          {currentStory.type === 'image' && currentStory.mediaUrl ? (
            <div className="w-full h-full flex flex-col items-center justify-center relative">
              <img
                src={currentStory.mediaUrl}
                alt="Story"
                className="w-full h-full object-contain pointer-events-none"
              />
              {currentStory.caption && (
                <div className="absolute bottom-16 left-0 right-0 p-4 text-center z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                  <p className="text-white text-sm md:text-base font-medium drop-shadow-md">
                    {currentStory.caption}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div
              className="w-full h-full flex items-center justify-center p-8 text-center"
              style={{ backgroundColor: currentStory.backgroundColor || '#075e54' }}
            >
              <p className="text-white text-xl md:text-2xl font-bold leading-relaxed break-words max-w-xs drop-shadow-md">
                {currentStory.text}
              </p>
            </div>
          )}

          {/* Left / Right Click Navigators */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-0 top-16 bottom-16 w-1/3 cursor-pointer z-20"
            title="Sebelumnya"
          />
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-0 top-16 bottom-16 w-2/3 cursor-pointer z-20"
            title="Selanjutnya"
          />
        </div>

        {/* Bottom Bar: Viewers (if owner) or Quick Reply (if friend) */}
        <div className="p-4 bg-gradient-to-t from-black/90 to-transparent z-30">
          {isOwner ? (
            <div className="flex items-center justify-center space-x-2 text-white/90 text-xs py-1">
              <Eye className="w-4 h-4 text-[#00a884]" />
              <span className="font-medium">
                Dilihat oleh {currentStory.viewers?.length || 0} orang
              </span>
              <span className="text-white/40">·</span>
              <span className="text-white/60">Hilang dalam 24 jam</span>
            </div>
          ) : (
            <form
              onSubmit={handleSendQuickReply}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
                placeholder="Balas status..."
                className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-sm text-white placeholder-white/60 focus:outline-none focus:border-[#00a884]"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="p-2.5 rounded-full bg-[#00a884] disabled:opacity-40 hover:bg-[#008f70] text-white transition shadow-md"
                title="Kirim balasan"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}

          {showReplySent && (
            <div className="text-center text-xs text-[#00a884] font-medium pt-1 animate-fade-in">
              Balasan terkirim ke chat!
            </div>
          )}
        </div>
      </div>

      {/* External Prev / Next Navigation Arrows on Desktop */}
      {onPrevGroup && (
        <button
          onClick={onPrevGroup}
          className="hidden md:flex absolute left-8 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-30 shadow-lg"
          title="Status kontak sebelumnya"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {onNextGroup && (
        <button
          onClick={onNextGroup}
          className="hidden md:flex absolute right-8 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-30 shadow-lg"
          title="Status kontak selanjutnya"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};
