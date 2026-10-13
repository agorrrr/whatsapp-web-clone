'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Send, Mic } from 'lucide-react';
import { AudioRecorderService } from '../utils/audio';

interface AudioRecorderProps {
  onCancel: () => void;
  onSend: (audioUrl: string, duration: number) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onCancel, onSend }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const recorderServiceRef = useRef<AudioRecorderService | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const recorder = new AudioRecorderService();
    recorderServiceRef.current = recorder;

    recorder.start().then(() => {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((sec) => sec + 1);
      }, 1000);
    }).catch((err) => {
      console.warn('Microphone permission not granted or device missing. Running simulated recording mode.', err);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((sec) => sec + 1);
      }, 1000);
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorder.cancel();
    };
  }, []);

  const handleStopAndSend = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const service = recorderServiceRef.current;
    if (service) {
      try {
        const { base64Url, duration } = await service.stop();
        onSend(base64Url, Math.max(duration, elapsedSeconds || 1));
      } catch {
        onSend('demo-sample-audio', Math.max(elapsedSeconds, 1));
      }
    } else {
      onSend('demo-sample-audio', Math.max(elapsedSeconds, 1));
    }
  };

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderServiceRef.current) {
      recorderServiceRef.current.cancel();
    }
    onCancel();
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center w-full px-3 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#222e35] select-none">
      {/* Cancel / Trash */}
      <button
        onClick={handleCancel}
        className="p-2 text-[#ea4335] hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors mr-3"
        title="Batal merekam"
      >
        <Trash2 className="w-5 h-5" />
      </button>

      {/* Recording status with pulsing red indicator */}
      <div className="flex items-center space-x-2 mr-4">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm font-semibold text-[#111b21] dark:text-[#e9edef]">
          {formatTime(elapsedSeconds)}
        </span>
      </div>

      {/* Animated audio level waves */}
      <div className="flex-1 flex items-center space-x-1 overflow-hidden h-6">
        {Array.from({ length: 32 }).map((_, i) => (
          <div
            key={i}
            className={`w-[3px] bg-[#00a884] rounded-full ${
              i % 4 === 0
                ? 'animate-wave-1'
                : i % 4 === 1
                ? 'animate-wave-2'
                : i % 4 === 2
                ? 'animate-wave-3'
                : 'animate-wave-4'
            }`}
            style={{
              height: `${12 + (i % 6) * 3}px`,
            }}
          />
        ))}
      </div>

      {/* Send Voice Note */}
      <button
        onClick={handleStopAndSend}
        className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f70] text-white flex items-center justify-center transition-colors shadow-md ml-3"
        title="Kirim Pesan Suara"
      >
        <Send className="w-5 h-5 ml-0.5 fill-current" />
      </button>
    </div>
  );
};
