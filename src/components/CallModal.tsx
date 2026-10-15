'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CallSession, ContactItem } from '../types/chat';
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
  UserPlus,
  Users,
  Search,
  X,
  Check,
  ScreenShare,
  ScreenShareOff,
} from 'lucide-react';

interface CallModalProps {
  call: CallSession;
  currentUserId: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  contacts?: ContactItem[];
  onEndCall: (callId: string, reason?: 'ended' | 'rejected') => void;
  onSendOffer?: (callId: string, sdpOffer: string) => void;
  onAnswerCall: (callId: string, sdpAnswer: string) => void;
  onSendIce: (callId: string, candidate: any) => void;
  onInviteParticipant?: (callId: string, targetUserId: string) => void;
  onSendMeshSignal?: (
    callId: string,
    signal: { fromUserId: string; toUserId: string; type: 'offer' | 'answer'; sdp: string }
  ) => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  call,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  contacts = [],
  onEndCall,
  onSendOffer,
  onAnswerCall,
  onSendIce,
  onInviteParticipant,
  onSendMeshSignal,
}) => {
  const isCaller = call.callerId === currentUserId;
  const isGroup = Boolean(call.isGroup || (call.participants && call.participants.length > 2));
  const otherPersonName = isGroup ? call.receiverName : isCaller ? call.receiverName : call.callerName;
  const otherPersonAvatar = isGroup ? call.receiverAvatar : isCaller ? call.receiverAvatar : call.callerAvatar;

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(call.type === 'audio');
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(isCaller || call.status === 'connected');
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [callingMemberId, setCallingMemberId] = useState<string | null>(null);

  // Media elements and references
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // WebRTC core peer connection (1-on-1 or initial join)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  // Mesh peer connections for group call (peerId -> RTCPeerConnection)
  const meshPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [remotePeerStreams, setRemotePeerStreams] = useState<Record<string, MediaStream>>({});
  const processedMeshSignalsRef = useRef<Set<string>>(new Set());

  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCandidatesRef = useRef<any[]>([]);
  const processedCandidatesRef = useRef<Set<string>>(new Set());

  const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:global.relay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:global.relay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];

  // Wait for ICE gathering to complete so host/relay candidates are bundled in SDP
  const waitForIceGathering = (pc: RTCPeerConnection, timeoutMs = 1200): Promise<string> => {
    if (pc.iceGatheringState === 'complete') {
      return Promise.resolve(pc.localDescription?.sdp || '');
    }
    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(pc.localDescription?.sdp || '');
        }
      }, timeoutMs);

      const onStateChange = () => {
        if (pc.iceGatheringState === 'complete' && !resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(pc.localDescription?.sdp || '');
        }
      };

      const onCand = (e: RTCPeerConnectionIceEvent) => {
        if (!e.candidate && !resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(pc.localDescription?.sdp || '');
        }
      };

      pc.addEventListener('icegatheringstatechange', onStateChange);
      pc.addEventListener('icecandidate', onCand);
    });
  };

  // Fallback placeholder track if OS locks hardware camera (e.g. multi-tab testing)
  const createPlaceholderVideoTrack = (label: string): MediaStreamTrack => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    let frame = 0;
    const draw = () => {
      if (!ctx) return;
      ctx.fillStyle = '#111b21';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#00a884';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, 320, 220);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#8696a0';
      ctx.fillText('Simulasi Video Aktif', 320, 255);
      ctx.fillStyle = '#00a884';
      ctx.beginPath();
      ctx.arc(320 + Math.sin(frame * 0.2) * 40, 290, 8, 0, Math.PI * 2);
      ctx.fill();
      frame++;
    };
    draw();
    const animTimer = setInterval(draw, 200);

    const stream = (canvas as any).captureStream
      ? (canvas as any).captureStream(15)
      : (canvas as any).mozCaptureStream(15);
    const track: MediaStreamTrack = stream.getVideoTracks()[0];
    if (track) {
      const origStop = track.stop.bind(track);
      track.stop = () => {
        clearInterval(animTimer);
        origStop();
      };
    }
    return track;
  };

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

  // Auto-hangup on ringing timeout (40 seconds)
  useEffect(() => {
    if (call.status !== 'ringing') return;
    const timer = setTimeout(() => {
      onEndCall(call.id, isCaller ? 'ended' : 'rejected');
    }, 40000);
    return () => clearTimeout(timer);
  }, [call.id, call.status, isCaller, onEndCall]);

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
        const key = typeof cand === 'string' ? cand : JSON.stringify(cand);
        if (!processedCandidatesRef.current.has(key)) {
          processedCandidatesRef.current.add(key);
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            console.warn('[WebRTC] Error adding queued ICE:', e);
          }
        }
      }
    }
  };

  // Initialize WebRTC local stream and core connection
  useEffect(() => {
    let isMounted = true;

    async function initWebRTC() {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: call.type === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
          });
        } catch (mediaErr: any) {
          console.warn('[WebRTC] Video+Audio capture failed, falling back:', mediaErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            if (call.type === 'video') {
              const placeholder = createPlaceholderVideoTrack('Kamera dipakai tab lain');
              stream.addTrack(placeholder);
            }
            setIsVideoDisabled(false);
          } catch (audioErr) {
            console.warn('[WebRTC] Audio fallback failed, generating synthesized track:', audioErr);
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const dst = ctx.createMediaStreamDestination();
            osc.connect(dst);
            osc.start();
            stream = dst.stream;
            if (call.type === 'video') {
              const placeholder = createPlaceholderVideoTrack('Kamera tidak tersedia');
              stream.addTrack(placeholder);
            }
          }
        }

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

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peerConnectionRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Remote track handler for 1-on-1 or initial peer
        pc.ontrack = (event) => {
          const remoteStream = remoteStreamRef.current;
          if (event.streams && event.streams[0]) {
            event.streams[0].getTracks().forEach((t) => {
              if (!remoteStream.getTracks().some((existing) => existing.id === t.id)) {
                remoteStream.addTrack(t);
              }
            });
          } else if (event.track) {
            if (!remoteStream.getTracks().some((existing) => existing.id === event.track.id)) {
              remoteStream.addTrack(event.track);
            }
          }

          if (event.track.kind === 'video') {
            setHasRemoteVideo(true);
          }

          if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(() => {});
          }
          if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(() => {});
          }
        };

        // ICE candidate handler (trickle fallback)
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const cand = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
            onSendIce(call.id, cand);
          }
        };

        // If caller, create SDP Offer and wait for ICE gathering to bundle candidates
        if (isCaller) {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: call.type === 'video',
          });
          await pc.setLocalDescription(offer);
          const fullOfferSdp = await waitForIceGathering(pc);
          onSendOffer?.(call.id, fullOfferSdp);
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
      meshPeerConnectionsRef.current.forEach((pc) => pc.close());
      meshPeerConnectionsRef.current.clear();
    };
  }, []);

  // Multi-participant WebRTC Mesh Initiation
  useEffect(() => {
    if (!hasAnswered || !localStreamRef.current || !call.participants || call.participants.length <= 1) {
      return;
    }

    call.participants.forEach((p) => {
      if (p.id === currentUserId) return;

      // Deterministic initiator: only peer with smaller ID initiates offer to prevent collision
      if (currentUserId < p.id && !meshPeerConnectionsRef.current.has(p.id)) {
        try {
          const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          meshPeerConnectionsRef.current.set(p.id, pc);

          const peerStream = new MediaStream();
          pc.ontrack = (e) => {
            if (e.streams && e.streams[0]) {
              e.streams[0].getTracks().forEach((t) => {
                if (!peerStream.getTracks().some((ex) => ex.id === t.id)) {
                  peerStream.addTrack(t);
                }
              });
            } else if (e.track) {
              if (!peerStream.getTracks().some((ex) => ex.id === e.track.id)) {
                peerStream.addTrack(e.track);
              }
            }
            setRemotePeerStreams((prev) => ({ ...prev, [p.id]: peerStream }));
          };

          localStreamRef.current?.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current!);
          });

          pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: call.type === 'video',
          }).then(async (offer) => {
            await pc.setLocalDescription(offer);
            const fullOfferSdp = await waitForIceGathering(pc);
            onSendMeshSignal?.(call.id, {
              fromUserId: currentUserId,
              toUserId: p.id,
              type: 'offer',
              sdp: fullOfferSdp,
            });
          });
        } catch (meshErr) {
          console.warn('[WebRTC Mesh Init Error]:', meshErr);
        }
      }
    });
  }, [call.participants, hasAnswered, currentUserId, call.id, call.type]);

  // Handle incoming mesh signals (Offers & Answers) from other participants
  useEffect(() => {
    if (!call.meshSignals || !hasAnswered) return;

    Object.values(call.meshSignals).forEach(async (signal) => {
      if (signal.toUserId === currentUserId) {
        const signalKey = `${signal.fromUserId}_${signal.toUserId}_${signal.type}_${signal.updatedAt}`;
        if (processedMeshSignalsRef.current.has(signalKey)) return;
        processedMeshSignalsRef.current.add(signalKey);

        const remoteUserId = signal.fromUserId;
        let pc = meshPeerConnectionsRef.current.get(remoteUserId);

        if (signal.type === 'offer') {
          try {
            if (!pc) {
              pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
              meshPeerConnectionsRef.current.set(remoteUserId, pc);

              const peerStream = new MediaStream();
              pc.ontrack = (e) => {
                if (e.streams && e.streams[0]) {
                  e.streams[0].getTracks().forEach((t) => {
                    if (!peerStream.getTracks().some((ex) => ex.id === t.id)) {
                      peerStream.addTrack(t);
                    }
                  });
                } else if (e.track) {
                  if (!peerStream.getTracks().some((ex) => ex.id === e.track.id)) {
                    peerStream.addTrack(e.track);
                  }
                }
                setRemotePeerStreams((prev) => ({ ...prev, [remoteUserId]: peerStream }));
              };

              localStreamRef.current?.getTracks().forEach((track) => {
                pc!.addTrack(track, localStreamRef.current!);
              });
            }

            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const fullAnswerSdp = await waitForIceGathering(pc);
            onSendMeshSignal?.(call.id, {
              fromUserId: currentUserId,
              toUserId: remoteUserId,
              type: 'answer',
              sdp: fullAnswerSdp,
            });
          } catch (offerErr) {
            console.warn('[WebRTC Mesh Answer Error]:', offerErr);
          }
        } else if (signal.type === 'answer') {
          try {
            if (pc && pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
            }
          } catch (ansErr) {
            console.warn('[WebRTC Mesh Remote Answer Error]:', ansErr);
          }
        }
      }
    });
  }, [call.meshSignals, hasAnswered, currentUserId, call.id]);

  // Bind local video element whenever it mounts or re-renders
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && call.type === 'video' && !isVideoDisabled) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
  }, [call.type, isVideoDisabled, hasAnswered, call.status]);

  // Keep remote media elements bound to remoteStream on state changes
  useEffect(() => {
    const stream = remoteStreamRef.current;
    if (!stream) return;

    if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== stream) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.play().catch(() => {});
    }

    if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [hasRemoteVideo, hasAnswered, call.status, isSpeakerMuted]);

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
          if (remoteAudioRef.current) {
            remoteAudioRef.current.play().catch(() => {});
          }
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
        const key = typeof cand === 'string' ? cand : JSON.stringify(cand);
        if (processedCandidatesRef.current.has(key)) return;

        if (pc.remoteDescription && pc.remoteDescription.type) {
          processedCandidatesRef.current.add(key);
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

    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }

    const pc = peerConnectionRef.current;
    if (!pc) return;

    let sdpOffer = call.sdpOffer;

    if (!sdpOffer) {
      // Retry fetching sdpOffer up to 10 times (4 seconds) if caller is still gathering ICE
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const res = await fetch(`/api/calls?callId=${encodeURIComponent(call.id)}`);
          const data = await res.json();
          if (data?.call?.sdpOffer) {
            sdpOffer = data.call.sdpOffer;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    if (sdpOffer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdpOffer }));
        await drainPendingIceCandidates(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const fullAnswerSdp = await waitForIceGathering(pc);
        onAnswerCall(call.id, fullAnswerSdp);
      } catch (err) {
        console.error('[WebRTC] Error answering call:', err);
        onAnswerCall(call.id, 'simulated_answer');
      }
    } else {
      console.warn('[WebRTC] No sdpOffer found on accept, signaling connected fallback');
      onAnswerCall(call.id, 'simulated_answer');
    }
  };

  // Receiver side: react if sdpOffer arrives or updates after answering
  useEffect(() => {
    const pc = peerConnectionRef.current;
    if (!pc || isCaller || !hasAnswered || !call.sdpOffer) return;
    if (call.sdpOffer === 'simulated_answer') return;
    if (pc.remoteDescription) return;

    async function processLateOffer() {
      try {
        await pc!.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: call.sdpOffer }));
        await drainPendingIceCandidates(pc!);
        const answer = await pc!.createAnswer();
        await pc!.setLocalDescription(answer);
        const fullAnswerSdp = await waitForIceGathering(pc!);
        onAnswerCall(call.id, fullAnswerSdp);
      } catch (err) {
        console.warn('[WebRTC] Late offer process error:', err);
      }
    }

    processLateOffer();
  }, [call.sdpOffer, hasAnswered, isCaller, call.id, onAnswerCall]);

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
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !remoteAudioRef.current.muted;
      setIsSpeakerMuted(remoteAudioRef.current.muted);
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        const sender = peerConnectionRef.current
          ?.getSenders()
          .find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(camTrack).catch(() => {});
        }
        meshPeerConnectionsRef.current.forEach((pc) => {
          const meshSender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (meshSender) meshSender.replaceTrack(camTrack).catch(() => {});
        });
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    } else {
      try {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          alert('Fitur bagi layar tidak didukung di peramban ini.');
          return;
        }
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const screenTrack = displayStream.getVideoTracks()[0];
        screenStreamRef.current = displayStream;

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        const sender = peerConnectionRef.current
          ?.getSenders()
          .find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack).catch(() => {});
        }
        meshPeerConnectionsRef.current.forEach((pc) => {
          const meshSender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (meshSender) meshSender.replaceTrack(screenTrack).catch(() => {});
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = displayStream;
        }
        setIsScreenSharing(true);
      } catch (err) {
        console.warn('Screen share canceled or failed:', err);
      }
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Candidate list for inviting or re-calling members
  const candidateList = useMemo(() => {
    const list: Array<{ id: string; name: string; avatar: string; username?: string }> = [];
    const seenIds = new Set<string>();

    if (call.groupMembers) {
      call.groupMembers.forEach((mId) => {
        if (mId === currentUserId) return;
        seenIds.add(mId);
        const c = contacts.find((ct) => ct.id === mId);
        list.push({
          id: mId,
          name: c?.name || 'Anggota Grup',
          avatar:
            c?.avatar ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          username: c?.username,
        });
      });
    }

    contacts.forEach((c) => {
      if (c.id === currentUserId || c.isGroup || seenIds.has(c.id)) return;
      seenIds.add(c.id);
      list.push({
        id: c.id,
        name: c.name,
        avatar: c.avatar,
        username: c.username,
      });
    });

    if (!inviteSearch.trim()) return list;
    const q = inviteSearch.toLowerCase();
    return list.filter(
      (item) => item.name.toLowerCase().includes(q) || item.username?.toLowerCase().includes(q)
    );
  }, [call.groupMembers, contacts, currentUserId, inviteSearch]);

  const handleInviteClick = async (targetUserId: string) => {
    setCallingMemberId(targetUserId);
    try {
      await onInviteParticipant?.(call.id, targetUserId);
    } finally {
      setTimeout(() => setCallingMemberId(null), 2500);
    }
  };

  const isVideoCallActive = call.type === 'video' && call.status === 'connected';
  const participantsCount = call.participants?.length || 1;
  const isMultiParticipantActive = hasAnswered && call.status === 'connected' && participantsCount > 2;

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        isFullscreen
          ? 'inset-0'
          : 'bottom-4 right-4 w-[380px] md:w-[480px] max-w-[calc(100vw-32px)] h-[620px] rounded-2xl shadow-2xl'
      } bg-[#111b21] border border-[#2a3942] flex flex-col overflow-hidden text-white select-none`}
    >
      {/* Remote Audio for 1-on-1 */}
      <audio ref={remoteAudioRef} autoPlay playsInline muted={isSpeakerMuted} />

      {/* Remote Video for 1-on-1 */}
      <video
        ref={(el) => {
          (remoteVideoRef as any).current = el;
          if (el && remoteStreamRef.current && el.srcObject !== remoteStreamRef.current) {
            el.srcObject = remoteStreamRef.current;
            el.play().catch(() => {});
          }
        }}
        autoPlay
        playsInline
        muted={true}
        className={
          isVideoCallActive && hasRemoteVideo && !isMultiParticipantActive
            ? 'absolute inset-0 w-full h-full object-cover z-0'
            : 'hidden'
        }
      />

      {/* Per-participant remote audio players in group call */}
      {call.participants &&
        call.participants.map((p) => {
          if (p.id === currentUserId) return null;
          const stream = remotePeerStreams[p.id];
          return (
            <audio
              key={`audio_stream_${p.id}`}
              autoPlay
              playsInline
              muted={isSpeakerMuted}
              ref={(el) => {
                if (el && stream && el.srcObject !== stream) {
                  el.srcObject = stream;
                  el.play().catch(() => {});
                }
              }}
            />
          );
        })}

      {/* Top action bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-30 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00a884] animate-pulse"></span>
          <span className="text-xs font-medium text-[#8696a0]">
            {isGroup ? 'Panggilan Grup' : 'Panggilan Terenkripsi'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {hasAnswered && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#00a884]/20 hover:bg-[#00a884]/30 border border-[#00a884]/40 text-[#00a884] text-xs font-semibold transition"
              title="Undang Peserta Baru atau Panggil Lagi"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Undang</span>
            </button>
          )}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-[#aebac1] transition"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Call View */}
      <div className="flex-1 flex flex-col items-center justify-center relative p-4 overflow-hidden">
        {/* MULTI-PARTICIPANT GROUP VIDEO/AUDIO GRID */}
        {isMultiParticipantActive && call.participants ? (
          <div
            className="w-full h-full grid gap-2.5 pt-12 pb-4 overflow-y-auto"
            style={{
              gridTemplateColumns: participantsCount <= 4 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
              gridAutoRows: participantsCount <= 2 ? '1fr' : 'minmax(140px, 1fr)',
            }}
          >
            {call.participants.map((p) => {
              const isMe = p.id === currentUserId;
              const peerStream = isMe ? localStreamRef.current : remotePeerStreams[p.id];
              const hasPeerVideo =
                call.type === 'video' &&
                (isMe ? !isVideoDisabled : (peerStream?.getVideoTracks().length || 0) > 0);

              return (
                <div
                  key={p.id}
                  className="rounded-2xl overflow-hidden bg-[#202c33] border border-[#2a3942] relative flex flex-col items-center justify-center shadow-lg group"
                >
                  {hasPeerVideo ? (
                    <video
                      autoPlay
                      playsInline
                      muted={isMe}
                      ref={(el) => {
                        if (el && peerStream && el.srcObject !== peerStream) {
                          el.srcObject = peerStream;
                          el.play().catch(() => {});
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-3 text-center">
                      <div className="relative">
                        <img
                          src={p.avatar}
                          alt={p.name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-[#00a884] shadow-md"
                        />
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-[#202c33]"></span>
                      </div>
                    </div>
                  )}

                  {/* Tile Bottom Name Pill */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-[11px] font-medium text-white z-10">
                    <span className="truncate">{p.name} {isMe ? '(Anda)' : ''}</span>
                    {isMe && isMuted ? (
                      <MicOff className="w-3.5 h-3.5 text-[#ea0038] flex-shrink-0" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-[#00a884] flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* STANDARD 1-ON-1 OR RINGING VIEW */
          <>
            {/* Local Video Picture-in-Picture */}
            {call.type === 'video' && !isVideoDisabled && (
              <div className="absolute top-16 right-4 w-28 h-40 rounded-xl overflow-hidden border-2 border-[#00a884] shadow-2xl z-20 bg-black">
                <video
                  ref={(el) => {
                    (localVideoRef as any).current = el;
                    if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
                      el.srcObject = localStreamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Avatar & status (when video loading, audio-only, or ringing) */}
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
                  {isGroup && (
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40">
                      Panggilan Grup
                    </span>
                  )}
                  <p className="text-sm font-medium text-[#8696a0] mt-1">
                    {call.status === 'connected'
                      ? `${formatDuration(callDuration)}${isGroup && call.participants ? ` · ${call.participants.length} peserta` : ''}`
                      : isCaller
                      ? isGroup ? 'Memanggil anggota grup...' : 'Memanggil...'
                      : isGroup
                      ? `Panggilan ${call.type === 'video' ? 'video' : 'suara'} grup dari ${call.callerName}...`
                      : 'Panggilan masuk...'}
                  </p>
                </div>

                {/* Group Call Participants Chips */}
                {isGroup && call.participants && call.participants.length > 0 && call.status === 'connected' && (
                  <div className="w-full max-w-sm mt-3 px-2">
                    <div className="text-[11px] text-[#00a884] font-semibold uppercase tracking-wider mb-2 text-center">
                      {call.participants.length} Peserta Terhubung
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto px-1 py-1">
                      {call.participants.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center space-x-2 bg-[#202c33]/90 border border-[#2a3942] rounded-xl p-2"
                        >
                          <div className="relative flex-shrink-0">
                            <img
                              src={p.avatar}
                              alt={p.name}
                              className="w-8 h-8 rounded-full object-cover border border-[#00a884]"
                            />
                            <span className="absolute bottom-0 right-0 w-2 h-2 bg-[#00a884] rounded-full border border-[#202c33]"></span>
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-xs font-semibold text-white truncate">
                              {p.name} {p.id === currentUserId ? '(Anda)' : ''}
                            </p>
                            <p className="text-[10px] text-[#8696a0] truncate">
                              {p.id === call.callerId ? 'Pembuat' : 'Tergabung'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* MODAL / SHEET: UNDANG PESERTA & PANGGIL LAGI */}
        {showInviteModal && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex flex-col p-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#2a3942]">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-[#00a884]" />
                <h3 className="font-semibold text-white text-base">Tambah / Panggil Peserta</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-[#8696a0] hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="my-3 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#8696a0]" />
              <input
                type="text"
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                placeholder="Cari nama atau username..."
                className="w-full bg-[#111b21] border border-[#2a3942] rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
              />
            </div>

            {/* Candidates List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {candidateList.length === 0 ? (
                <p className="text-center text-xs text-[#8696a0] py-8">Tidak ada kontak ditemukan.</p>
              ) : (
                candidateList.map((person) => {
                  const isJoined = call.participants?.some((p) => p.id === person.id);
                  const isInvited = call.invitedUsers?.includes(person.id);
                  const isCallingNow = callingMemberId === person.id;

                  return (
                    <div
                      key={person.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#202c33] border border-[#2a3942] hover:border-[#374248] transition"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <img
                          src={person.avatar}
                          alt={person.name}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{person.name}</p>
                          {person.username && (
                            <p className="text-xs text-[#00a884] truncate">@{person.username}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        {isJoined ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40 flex items-center space-x-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Tergabung</span>
                          </span>
                        ) : isCallingNow ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 animate-pulse">
                            Memanggil...
                          </span>
                        ) : isInvited ? (
                          <button
                            onClick={() => handleInviteClick(person.id)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#ea0038] hover:bg-[#d00032] text-white flex items-center space-x-1 transition shadow"
                            title="Panggil lagi anggota ini"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Panggil Lagi</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleInviteClick(person.id)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#00a884] hover:bg-[#008f70] text-white flex items-center space-x-1 transition shadow"
                            title="Undang ke panggilan ini"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Panggil</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="p-5 bg-[#202c33]/95 backdrop-blur-md flex items-center justify-around z-30 border-t border-[#2a3942]">
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
              <span className="font-semibold text-white">{isGroup ? 'Gabung' : 'Terima'}</span>
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

            {/* Screen Share Toggle */}
            {call.type === 'video' && (
              <button
                onClick={toggleScreenShare}
                className={`p-3.5 rounded-full transition ${
                  isScreenSharing
                    ? 'bg-[#00a884] text-white'
                    : 'bg-[#374248] text-[#aebac1] hover:bg-[#4a575f]'
                }`}
                title={isScreenSharing ? 'Hentikan Berbagi Layar' : 'Bagikan Layar'}
              >
                {isScreenSharing ? (
                  <ScreenShareOff className="w-5 h-5" />
                ) : (
                  <ScreenShare className="w-5 h-5" />
                )}
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

            {/* Invite / Re-call Participant Button */}
            <button
              onClick={() => setShowInviteModal(true)}
              className="p-3.5 rounded-full bg-[#374248] text-[#00a884] hover:bg-[#4a575f] transition relative"
              title="Tambah / Panggil Peserta"
            >
              <UserPlus className="w-5 h-5" />
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
