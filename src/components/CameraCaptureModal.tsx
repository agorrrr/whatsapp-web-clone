'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, SwitchCamera, AlertCircle } from 'lucide-react';

interface CameraCaptureModalProps {
  onCapture: (imageUrl: string) => void;
  onClose: () => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  onCapture,
  onClose,
}) => {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function startCamera() {
      setErrorMsg('');
      try {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        activeStream = media;
        setStream(media);
        if (videoRef.current) {
          videoRef.current.srcObject = media;
        }
      } catch (err: any) {
        console.warn('Camera access error:', err);
        setErrorMsg('Tidak dapat mengakses kamera langsung. Silakan gunakan opsi kamera sistem.');
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleSnap = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally if front camera for natural mirror effect
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    // Stop camera stream
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    onCapture(dataUrl);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          if (stream) {
            stream.getTracks().forEach((t) => t.stop());
          }
          onCapture(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none">
      {/* Top Bar */}
      <div className="h-16 px-5 flex items-center justify-between bg-black/60 backdrop-blur-sm z-20">
        <button
          onClick={handleClose}
          className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
          title="Tutup"
        >
          <X className="w-6 h-6" />
        </button>
        <span className="font-semibold text-sm">Ambil Foto</span>
        <button
          onClick={toggleFacingMode}
          className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
          title="Putar Kamera"
        >
          <SwitchCamera className="w-6 h-6" />
        </button>
      </div>

      {/* Camera Viewfinder */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-neutral-950">
        {errorMsg ? (
          <div className="p-6 text-center max-w-sm flex flex-col items-center">
            <AlertCircle className="w-12 h-12 text-yellow-500 mb-3" />
            <p className="text-sm text-neutral-300 mb-4">{errorMsg}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold shadow"
            >
              Buka Kamera Ponsel
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'transform scale-x-[-1]' : ''}`}
          />
        )}

        {/* Hidden system camera capture fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Bottom Shutter Bar */}
      <div className="h-28 bg-black/80 flex items-center justify-center px-6 z-20">
        {!errorMsg && (
          <button
            onClick={handleSnap}
            className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center p-1 hover:scale-105 active:scale-95 transition-transform"
            title="Ambil Foto"
          >
            <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
              <Camera className="w-7 h-7 text-neutral-900" />
            </div>
          </button>
        )}
      </div>
    </div>
  );
};
