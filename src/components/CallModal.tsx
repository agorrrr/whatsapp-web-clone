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
  onSendOffer?: (callId: string, sdpOffer: string) => void;
  onAnswerCall: (callId: string, sdpAnswer: string) => void;
  onSendIce: (callId: string, candidate: any) => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  call,
  currentUserId,
  onEndCall,
  onSendOffer,
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
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteMediaRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCandidatesRef = useRef<any[]>([]);

  // Synthesize WhatsApp-style ringing audio using native Web Audio API
  const startRingtone = (mode: 'outgoing' | 'incoming') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      if (mode === 'outgoing') {
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
        const notes = [523.25, 659.25, 783.99, 1046.5];
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

  // Ringtone control
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

  // Drain pending ICE candidates once remote description is set
  const drainPendingIceCandidates = async (pc: RTCPeerConnection) => {
    while (pendingCandidatesRef.current.length > 0) {
      const cand = pendingCandidatesRef.current.shift();
      if (cand) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('[WebRTC] Error adding queued ICE:', e);
        }
      }
    }
  };

  // Initialize WebRTC
  useEffect(() => {
    let isMounted = true;

    async function initWebRTC() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: call.type === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;

        // Local video preview
        if (localVideoRef.current && call.type === 'video') {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        });
        peerConnectionRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Remote track handler
        pc.ontrack = (event) => {
          let remoteStream = event.streams[0];
          if (!remoteStream) {
            remoteStream = new MediaStream([event.track]);
          }

          if (event.track.kind === 'video') {
            setHasRemoteVideo(true);
          }

          if (remoteMediaRef.current) {
            remoteMediaRef.current.srcObject = remoteStream;
            remoteMediaRef.current.play().catch((err) => {
              console.warn('[WebRTC] Remote media play error:', err);
            });
          }
        };

        // ICE candidate handler
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const cand = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
            onSendIce(call.id, cand);
          }
        };

        // If caller, create SDP Offer and send to server & receiver
        if (isCaller) {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: call.type === 'video',
          });
          await pc.setLocalDescription(offer);
          onSendOffer?.(call.id, offer.sdp || '');
        }
      } catch (err: any) {
        console.error('[WebRTC] Media permission error:', err);
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

  // Bind local video element whenever it mounts or re-renders
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && call.type === 'video' && !isVideoDisabled) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
  }, [call.type, isVideoDisabled, hasAnswered, call.status]);

  // Handle incoming SDP Answer on Caller side
  useEffect(() => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    if (
      isCaller &&
      call.sdpAnswer &&
      call.sdpAnswer !== 'simulated_answer' &&
      pc.signalingState === 'have-local-offer'
    ) {
      pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: call.sdpAnswer }))
        .then(() => {
          drainPendingIceCandidates(pc);
        })
        .catch((err) => {
          console.error('[WebRTC] Error setting caller remote answer:', err);
        });
    }
  }, [call.sdpAnswer, isCaller]);

  // Handle incoming ICE candidates
  useEffect(() => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    const remoteCandidates = isCaller ? call.receiverIce : call.callerIce;
    if (Array.isArray(remoteCandidates)) {
      remoteCandidates.forEach((cand) => {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {}
        } else {
          pendingCandidatesRef.current.push(cand);
        }
      });
    }
  }, [call.callerIce, call.receiverIce, isCaller]);

  // Accept call (Receiver side)
  const handleAcceptCall = async () => {
    stopRingtone();
    setHasAnswered(true);

    const pc = peerConnectionRef.current;
    if (!pc) return;

    let sdpOffer = call.sdpOffer;

    // If sdpOffer is not yet in state, fetch latest from server
    if (!sdpOffer) {
      try {
        const res = await fetch(`/api/calls?callId=${encodeURIComponent(call.id)}`);
        const data = await res.json();
        if (data?.call?.sdpOffer) {
          sdpOffer = data.call.sdpOffer;
        }
      } catch {}
    }

    if (sdpOffer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdpOffer }));
        await drainPendingIceCandidates(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        onAnswerCall(call.id, answer.sdp || '');
      } catch (err) {
        console.error('[WebRTC] Error answering call:', err);
        onAnswerCall(call.id, 'simulated_answer');
      }
    } else {
      console.warn('[WebRTC] No sdpOffer found on accept, signaling connected fallback');
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
    if (remoteMediaRef.current) {
      remoteMediaRef.current.muted = !remoteMediaRef.current.muted;
      setIsSpeakerMuted(remoteMediaRef.current.muted);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isVideoCallActive = call.type === 'video' && call.status === 'connected';

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        isFullscreen
          ? 'inset-0'
          : 'bottom-4 right-4 w-[380px] md:w-[420px] max-w-[calc(100vw-32px)] h-[580px] rounded-2xl shadow-2xl'
      } bg-[#111b21] border border-[#2a3942] flex flex-col overflow-hidden text-white select-none`}
    >
      {/* Universal Remote Media Element (Audio & Video) */}
      {/* Kept mounted at all times to prevent browser audio pause / mute */}
      <video
        ref={remoteMediaRef}
        autoPlay
        playsInline
        muted={isSpeakerMuted}
        className={
          isVideoCallActive && hasRemoteVideo
            ? 'absolute inset-0 w-full h-full object-cover z-0'
            : 'fixed -top-[9999px] -left-[9999px] w-px h-px opacity-0 pointer-events-none'
        }
      />

      {/* Top action bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20 bg-gradient-to-b from-black/70 to-transparent">
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

      {/* Main Call View */}
      <div className="flex-1 flex flex-col items-center justify-center relative p-6">
        {/* Local Video Picture-in-Picture */}
        {call.type === 'video' && !isVideoDisabled && (
          <div className="absolute top-16 right-4 w-28 h-40 rounded-xl overflow-hidden border-2 border-[#00a884] shadow-2xl z-20 bg-black">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Avatar and status banner (visible when audio-only or video is loading/ringing) */}
        {(!isVideoCallActive || !hasRemoteVideo) && (
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
      </div>

      {/* Bottom Controls Bar */}
      <div className="p-6 bg-[#202c33]/90 backdrop-blur-md flex items-center justify-around z-20 border-t border-[#2a3942]">
        {!isCaller && !hasAnswered && call.status === 'ringing' ? (
          /* Incoming Call Ringing Controls */
          <div className="flex items-center justify-around w-full">
            {/* Decline Button */}
            <button
              onClick={() => onEndCall(call.id, 'rejected')}
              className="flex flex-col items-center space-y-1.5 text-xs text-[#ea0038]"
            >
              <div className="w-14 h-14 rounded-full bg-[#ea0038] hover:bg-[#d00032] flex items-center justify-center text-white shadow-lg transition">
                <PhoneOff className="w-6 h-6" />
              </div>
              <span className="font-semibold text-white">Tolak</span>
            </button>

            {/* Accept Button */}
            <button
              onClick={handleAcceptCall}
              className="flex flex-col items-center space-y-1.5 text-xs text-[#00a884]"
            >
              <div className="w-14 h-14 rounded-full bg-[#00a884] hover:bg-[#008f70] flex items-center justify-center text-white shadow-lg transition animate-bounce">
                {call.type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </div>
              <span className="font-semibold text-white">Terima</span>
            </button>
          </div>
        ) : (
          /* Active Call Controls */
          <div className="flex items-center justify-around w-full">
            {/* Mic Toggle */}
            <button
              onClick={toggleMute}
              className={`p-3.5 rounded-full transition ${
                isMuted ? 'bg-[#ea0038] text-white' : 'bg-[#374248] text-[#aebac1] hover:bg-[#4a575f]'
              }`}
              title={isMuted ? 'Buka Mic' : 'Matikan Mic'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Video Toggle (Video call only) */}
            {call.type === 'video' && (
              <button
                onClick={toggleVideo}
                className={`p-3.5 rounded-full transition ${
                  isVideoDisabled
                    ? 'bg-[#ea0038] text-white'
                    : 'bg-[#374248] text-[#aebac1] hover:bg-[#4a575f]'
                }`}
                title={isVideoDisabled ? 'Nyalakan Kamera' : 'Matikan Kamera'}
              >
                {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}

            {/* Speaker Toggle */}
            <button
              onClick={toggleSpeaker}
              className={`p-3.5 rounded-full transition ${
                isSpeakerMuted
                  ? 'bg-[#ea0038] text-white'
                  : 'bg-[#374248] text-[#aebac1] hover:bg-[#4a575f]'
              }`}
              title={isSpeakerMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
            >
              {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {/* End Call Button */}
            <button
              onClick={() => onEndCall(call.id, 'ended')}
              className="p-3.5 rounded-full bg-[#ea0038] hover:bg-[#d00032] text-white transition shadow-lg"
              title="Akhiri Panggilan"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
