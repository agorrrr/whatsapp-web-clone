'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CallSession } from '../types/chat';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface CallModalProps {
  call: CallSession;
  currentUserId: string;
  onEndCall: (callId: string, reason?: 'ended' | 'rejected') => void;
  onAnswerCall: (callId: string, sdpAnswer: string) => void;
  onSendIce: (callId: string, candidate: any) => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  call,
  currentUserId,
  onEndCall,
  onAnswerCall,
  onSendIce,
}) => {
  const isCaller = call.callerId === currentUserId;
  const otherPersonName = isCaller ? call.receiverName : call.callerName;
  const otherPersonAvatar = isCaller ? call.receiverAvatar : call.callerAvatar;

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(call.type === 'audio');
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(isCaller || call.status === 'connected');

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Synthesize WhatsApp-style ringing audio using native Web Audio API
  const startRingtone = (mode: 'outgoing' | 'incoming') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      if (mode === 'outgoing') {
        // WhatsApp outgoing soft dual tone (400Hz + 450Hz) beep... beep...
        const playBeep = () => {
          if (ctx.state === 'closed') return;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.frequency.value = 400;
          osc2.frequency.value = 450;
          gain.gain.setValueAtTime(0.06, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start();
          osc2.start();
          osc1.stop(ctx.currentTime + 1.2);
          osc2.stop(ctx.currentTime + 1.2);
        };

        playBeep();
        ringtoneIntervalRef.current = setInterval(playBeep, 3000);
      } else {
        // WhatsApp incoming playful chime sequence
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        const playChime = () => {
          if (ctx.state === 'closed') return;
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const startTime = ctx.currentTime + idx * 0.18;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.08, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + 0.35);
          });
        };

        playChime();
        ringtoneIntervalRef.current = setInterval(playChime, 2500);
      }
    } catch {}
  };

  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
  };

  // Ringtone handling
  useEffect(() => {
    if (call.status === 'ringing') {
      startRingtone(isCaller ? 'outgoing' : 'incoming');
    } else {
      stopRingtone();
    }
    return () => stopRingtone();
  }, [call.status, isCaller]);

  // Duration timer
  useEffect(() => {
    if (call.status !== 'connected') return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [call.status]);

  // WebRTC initialization
  useEffect(() => {
    let isMounted = true;

    async function initWebRTC() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: call.type === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current && call.type === 'video') {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        });
        peerConnectionRef.current = pc;

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            onSendIce(call.id, event.candidate);
          }
        };

        // If caller, produce SDP offer
        if (isCaller) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
        }
      } catch (err: any) {
        console.warn('[WebRTC] Media permission or connection notice:', err.message);
      }
    }

    initWebRTC();

    return () => {
      isMounted = false;
      stopRingtone();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  // Handle incoming SDP Answer or ICE candidates
  useEffect(() => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    if (isCaller && call.sdpAnswer && pc.signalingState === 'have-local-offer') {
      try {
        pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: call.sdpAnswer }));
      } catch {}
    }

    // Add remote ICE candidates
    const remoteIce = isCaller ? call.receiverIce : call.callerIce;
    if (Array.isArray(remoteIce) && pc.remoteDescription) {
      remoteIce.forEach((candidate) => {
        try {
          pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      });
    }
  }, [call.sdpAnswer, call.callerIce, call.receiverIce, isCaller]);

  // Answer call handler (receiver side)
  const handleAcceptCall = async () => {
    stopRingtone();
    setHasAnswered(true);

    const pc = peerConnectionRef.current;
    if (pc && call.sdpOffer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: call.sdpOffer }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        onAnswerCall(call.id, answer.sdp || '');
      } catch {
        onAnswerCall(call.id, 'simulated_answer');
      }
    } else {
      onAnswerCall(call.id, 'simulated_answer');
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle Camera
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  // Toggle Speaker
  const toggleSpeaker = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
      setIsSpeakerMuted(remoteVideoRef.current.muted);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        isFullscreen
          ? 'inset-0'
          : 'bottom-4 right-4 w-[380px] md:w-[420px] max-w-[calc(100vw-32px)] h-[580px] rounded-2xl shadow-2xl'
      } bg-[#111b21] border border-[#2a3942] flex flex-col overflow-hidden text-white`}
    >
      {/* Top action bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00a884] animate-pulse"></span>
          <span className="text-xs font-medium text-[#8696a0]">
            Panggilan WhatsApp Terenkripsi End-to-End
          </span>
        </div>
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-[#aebac1] transition"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex flex-col items-center justify-center relative p-6">
        {/* Remote Video Stream if video call & connected */}
        {call.type === 'video' && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`absolute inset-0 w-full h-full object-cover ${
              call.status === 'connected' ? 'block' : 'hidden'
            }`}
          />
        )}

        {/* Local Video Picture-in-Picture */}
        {call.type === 'video' && !isVideoDisabled && (
          <div className="absolute top-16 right-4 w-28 h-40 rounded-xl overflow-hidden border-2 border-[#00a884] shadow-lg z-20 bg-black">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          </div>
        )}

        {/* Avatar and status (visible when audio call or still ringing) */}
        {(call.type === 'audio' || call.status !== 'connected') && (
          <div className="flex flex-col items-center text-center z-10 space-y-4">
            <div className="relative">
              {call.status === 'ringing' && (
                <div className="absolute -inset-3 rounded-full bg-[#00a884]/20 animate-ping"></div>
              )}
              <img
                src={otherPersonAvatar}
                alt={otherPersonName}
                className="w-28 h-28 rounded-full object-cover border-4 border-[#202c33] shadow-xl relative z-10"
              />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-[#e9edef]">{otherPersonName}</h2>
              <p className="text-sm font-medium text-[#8696a0] mt-1">
                {call.status === 'connected'
                  ? formatDuration(callDuration)
                  : isCaller
                  ? 'Memanggil...'
                  : 'Panggilan masuk...'}
              </p>
            </div>
          </div>
        )}

        {/* Hidden audio element for remote stream in voice calls */}
        {call.type === 'audio' && <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />}
      </div>

      {/* Bottom Controls */}
      <div className="p-6 bg-[#202c33]/90 backdrop-blur-md flex items-center justify-around z-20 border-t border-[#2a3942]">
        {/* If incoming call and not yet accepted */}
        {!isCaller && !hasAnswered && call.status === 'ringing' ? (
          <div className="flex items-center justify-around w-full">
            {/* Decline */}
            <button
              onClick={() => onEndCall(call.id, 'rejected')}
              className="flex flex-col items-center space-y-1.5 text-xs text-[#ea0038]"
            >
              <div className="w-14 h-14 rounded-full bg-[#ea0038] hover:bg-[#d00032] flex items-center justify-center text-white shadow-lg transition">
                <PhoneOff className="w-6 h-6" />
              </div>
              <span>Tolak</span>
            </button>

            {/* Accept */}
            <button
              onClick={handleAcceptCall}
              className="flex flex-col items-center space-y-1.5 text-xs text-[#25d366]"
            >
              <div className="w-14 h-14 rounded-full bg-[#25d366] hover:bg-[#20ba59] flex items-center justify-center text-white shadow-lg animate-bounce transition">
                <Phone className="w-6 h-6" />
              </div>
              <span>Terima</span>
            </button>
          </div>
        ) : (
          /* Active call controls */
          <>
            {/* Mic Toggle */}
            <button
              onClick={toggleMute}
              className={`p-3.5 rounded-full transition ${
                isMuted
                  ? 'bg-red-500/20 text-red-500 border border-red-500/50'
                  : 'bg-[#111b21] hover:bg-[#2a3942] text-[#e9edef]'
              }`}
              title={isMuted ? 'Buka mic' : 'Matikan mic'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Video Toggle (if video call) */}
            {call.type === 'video' && (
              <button
                onClick={toggleVideo}
                className={`p-3.5 rounded-full transition ${
                  isVideoDisabled
                    ? 'bg-red-500/20 text-red-500 border border-red-500/50'
                    : 'bg-[#111b21] hover:bg-[#2a3942] text-[#e9edef]'
                }`}
                title={isVideoDisabled ? 'Nyalakan kamera' : 'Matikan kamera'}
              >
                {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}

            {/* Speaker Toggle */}
            <button
              onClick={toggleSpeaker}
              className={`p-3.5 rounded-full transition ${
                isSpeakerMuted
                  ? 'bg-red-500/20 text-red-500 border border-red-500/50'
                  : 'bg-[#111b21] hover:bg-[#2a3942] text-[#e9edef]'
              }`}
              title={isSpeakerMuted ? 'Nyalakan suara' : 'Bisukan suara'}
            >
              {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {/* Hangup / End call button */}
            <button
              onClick={() => onEndCall(call.id, 'ended')}
              className="p-3.5 rounded-full bg-[#ea0038] hover:bg-[#d00032] text-white shadow-lg transition"
              title="Akhiri panggilan"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
