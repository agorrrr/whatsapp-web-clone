'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types/chat';
import { Check, CheckCheck, Play, Pause, FileText, CornerUpLeft, Smile, Phone, PhoneMissed, Video, VideoOff } from 'lucide-react';
import { createDemoAudioDataUrl } from '../utils/audio';

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  onReply?: (message: Message) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onImageClick?: (url: string) => void;
  onSenderClick?: (senderId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMe,
  onReply,
  onReaction,
  onImageClick,
  onSenderClick,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [showReactionBar, setShowReactionBar] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (message.type === 'audio') {
      let src = message.mediaUrl || '';
      if (src === 'demo-sample-audio' || !src) {
        src = createDemoAudioDataUrl();
      }
      const audio = new Audio(src);
      audio.playbackRate = playbackRate;
      
      audio.ontimeupdate = () => {
        if (audio.duration) {
          const prog = (audio.currentTime / audio.duration) * 100;
          setAudioProgress(prog);
          const mins = Math.floor(audio.currentTime / 60);
          const secs = Math.floor(audio.currentTime % 60);
          setCurrentTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
        }
      };

      audio.onended = () => {
        setIsPlaying(false);
        setAudioProgress(0);
        setCurrentTime('0:00');
      };

      audio.onerror = () => {
        setIsPlaying(false);
      };

      audioRef.current = audio;

      return () => {
        audio.pause();
        audioRef.current = null;
      };
    }
  }, [message.type, message.mediaUrl]);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const cyclePlaybackRate = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  // Sticker has transparent styling without normal bubble box
  if (message.type === 'sticker') {
    return (
      <div className={`flex w-full mb-2 ${isMe ? 'justify-end' : 'justify-start'} group relative`}>
        <div className="relative max-w-[170px] select-none">
          <img
            src={message.mediaUrl}
            alt="Stiker"
            className="w-36 h-36 object-contain filter drop-shadow hover:scale-105 transition-transform cursor-pointer"
          />
          <div className="flex items-center justify-end space-x-1 mt-1 text-[11px] text-[#667781] dark:text-[#8696a0]">
            <span>{message.timestamp}</span>
            {isMe && (
              message.status === 'read' ? (
                <CheckCheck className="w-4 h-4 text-[#53bdeb]" />
              ) : message.status === 'delivered' ? (
                <CheckCheck className="w-4 h-4 text-[#8696a0]" />
              ) : (
                <Check className="w-4 h-4 text-[#8696a0]" />
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex w-full mb-1 ${isMe ? 'justify-end' : 'justify-start'} group relative`}
      onMouseLeave={() => setShowReactionBar(false)}
    >
      {/* Reaction floating bar trigger */}
      <div
        className={`relative max-w-[85%] md:max-w-[65%] rounded-lg px-2.5 py-1.5 shadow-sm text-sm ${
          isMe
            ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-tr-none'
            : 'bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-tl-none'
        }`}
      >
        {/* Reply Quote preview if present */}
        {message.replyTo && (
          <div className="mb-1 rounded border-l-4 border-[#00a884] bg-black/5 dark:bg-white/5 p-1.5 text-xs">
            <span className="font-semibold text-[#00a884] block">
              {message.replyTo.senderName}
            </span>
            <span className="truncate block opacity-80">
              {message.replyTo.text || message.replyTo.type}
            </span>
          </div>
        )}

        {/* Sender Name in group */}
        {!isMe && message.senderName && (
          <div
            onClick={() => onSenderClick?.(message.senderId)}
            className="text-[12px] font-semibold text-[#128c7e] dark:text-[#25d366] mb-0.5 cursor-pointer hover:underline"
            title="Klik untuk lihat profil"
          >
            {message.senderName}
          </div>
        )}

        {/* IMAGE MESSAGE */}
        {message.type === 'image' && (
          <div className="mb-1 rounded overflow-hidden cursor-pointer" onClick={() => onImageClick?.(message.mediaUrl || '')}>
            <img
              src={message.mediaUrl}
              alt="Gambar"
              className="max-h-80 w-full object-cover rounded hover:opacity-95 transition-opacity"
            />
            {message.text && (
              <p className="mt-1 text-sm whitespace-pre-wrap">{message.text}</p>
            )}
          </div>
        )}

        {/* AUDIO / VOICE NOTE MESSAGE */}
        {message.type === 'audio' && (
          <div className="flex items-center space-x-3 py-1 min-w-[240px] sm:min-w-[280px]">
            {/* Play / Pause button */}
            <button
              onClick={toggleAudio}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#00a884] hover:bg-[#008f70] text-white transition-colors flex-shrink-0 shadow"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            {/* Waveform / Progress bar */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="relative w-full h-7 flex items-center space-x-0.5">
                {/* 28 simulated audio wave bars */}
                {Array.from({ length: 28 }).map((_, i) => {
                  const height = 6 + Math.abs(Math.sin((i * 12) + 2) * 18);
                  const isPast = (i / 28) * 100 <= audioProgress;
                  return (
                    <div
                      key={i}
                      style={{ height: `${height}px` }}
                      className={`w-[3px] rounded-full transition-colors ${
                        isPast ? 'bg-[#00a884]' : 'bg-[#aebac1] dark:bg-[#667781]'
                      } ${isPlaying && isPast ? 'animate-wave-1' : ''}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between items-center text-[11px] text-[#667781] dark:text-[#8696a0]">
                <span>{isPlaying ? currentTime : `${message.audioDuration || 3}s`}</span>
                <button
                  onClick={cyclePlaybackRate}
                  className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 text-[10px] font-bold"
                >
                  {playbackRate}x
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DOCUMENT MESSAGE */}
        {message.type === 'document' && (
          <div className="flex items-center space-x-3 p-2 bg-black/5 dark:bg-white/5 rounded-md mb-1">
            <FileText className="w-8 h-8 text-[#00a884]" />
            <div className="flex-1 overflow-hidden">
              <div className="font-medium text-xs truncate">{message.fileName || 'Dokumen.pdf'}</div>
              <div className="text-[10px] text-[#667781] dark:text-[#8696a0]">{message.fileSize || '1.2 MB'}</div>
            </div>
          </div>
        )}

        {/* CALL MESSAGE EVENT */}
        {message.type === 'call' && (
          <div className="flex items-center space-x-3 p-1.5 pr-14 select-none">
            <div
              className={`p-2.5 rounded-full ${
                message.callInfo?.status === 'missed' || message.callInfo?.status === 'declined'
                  ? 'bg-red-500/15 text-red-500'
                  : 'bg-[#00a884]/15 text-[#00a884]'
              }`}
            >
              {message.callInfo?.type === 'video' ? (
                message.callInfo?.status === 'missed' ? (
                  <VideoOff className="w-5 h-5" />
                ) : (
                  <Video className="w-5 h-5" />
                )
              ) : message.callInfo?.status === 'missed' ? (
                <PhoneMissed className="w-5 h-5" />
              ) : (
                <Phone className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="font-medium text-sm text-[#111b21] dark:text-[#e9edef]">
                {message.text}
              </div>
              <div className="text-[11px] text-[#667781] dark:text-[#8696a0]">
                {message.callInfo?.status === 'completed'
                  ? 'Panggilan selesai'
                  : message.callInfo?.status === 'declined'
                  ? 'Panggilan ditolak'
                  : 'Panggilan tak terjawab'}
              </div>
            </div>
          </div>
        )}

        {/* REGULAR TEXT MESSAGE */}
        {message.type === 'text' && (
          <p className="whitespace-pre-wrap break-words leading-relaxed pr-14 text-[14.2px]">
            {message.text}
          </p>
        )}

        {/* Timestamp and Delivery ticks */}
        <div className="absolute right-2 bottom-1 flex items-center space-x-1 text-[11px] text-[#667781] dark:text-[#8696a0] select-none">
          <span>{message.timestamp}</span>
          {isMe && (
            message.status === 'read' ? (
              <CheckCheck className="w-4 h-4 text-[#53bdeb]" />
            ) : message.status === 'delivered' ? (
              <CheckCheck className="w-4 h-4 text-[#8696a0]" />
            ) : (
              <Check className="w-4 h-4 text-[#8696a0]" />
            )
          )}
        </div>

        {/* Message Reaction badge if any */}
        {message.reaction && (
          <div className="absolute -bottom-2.5 right-2 bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#222e35] rounded-full px-1.5 py-0.5 text-xs shadow-sm flex items-center">
            {message.reaction}
          </div>
        )}
      </div>

      {/* Floating Action Menu (Reply & Quick React) */}
      <div
        className={`opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 ${
          isMe ? 'left-[-60px]' : 'right-[-60px]'
        } flex items-center space-x-1 bg-white/80 dark:bg-[#202c33]/80 backdrop-blur-sm p-1 rounded-full shadow-md z-10`}
      >
        <button
          onClick={() => onReply?.(message)}
          title="Balas"
          className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-[#667781] dark:text-[#8696a0]"
        >
          <CornerUpLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setShowReactionBar(!showReactionBar)}
          title="Beri Reaksi"
          className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-[#667781] dark:text-[#8696a0]"
        >
          <Smile className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Reaction Popup */}
      {showReactionBar && (
        <div
          className={`absolute top-[-36px] ${
            isMe ? 'right-0' : 'left-0'
          } flex space-x-1.5 bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#222e35] shadow-lg rounded-full px-3 py-1.5 z-20`}
        >
          {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReaction?.(message.id, emoji);
                setShowReactionBar(false);
              }}
              className="hover:scale-125 transition-transform text-base"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
