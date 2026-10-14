'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UserAccount } from '../types/chat';
import {
  X,
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  UserCheck,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Terminal,
  Laptop,
} from 'lucide-react';

interface SyncRealWaModalProps {
  currentUser: UserAccount;
  onProfileSynced: (updatedUser: UserAccount) => void;
  onClose: () => void;
}

interface BaileysStatusData {
  status: 'idle' | 'connecting' | 'qrcode' | 'pairing' | 'connected' | 'error' | 'disconnected';
  qrCode: string | null;
  pairingCode: string | null;
  user: {
    id: string;
    phone: string;
    name: string;
    avatar?: string;
    about?: string;
  } | null;
  lastError: string | null;
  connectedAt?: string | null;
}

export const SyncRealWaModal: React.FC<SyncRealWaModalProps> = ({
  currentUser,
  onProfileSynced,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'pairing' | 'gateway'>('qr');
  const [statusData, setStatusData] = useState<BaileysStatusData>({
    status: 'idle',
    qrCode: null,
    pairingCode: null,
    user: null,
    lastError: null,
  });
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(currentUser.phone || '');
  const [syncingProfile, setSyncingProfile] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(45);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Poll status from /api/baileys without losing existing QR code during handshakes
  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/baileys?_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setStatusData((prev) => {
          // If server reports new QR code, reset countdown
          if (data.qrCode && data.qrCode !== prev.qrCode) {
            setQrCountdown(45);
          }
          return {
            status: data.status,
            // Keep previous QR code so it doesn't flicker or disappear
            qrCode: data.qrCode || prev.qrCode,
            pairingCode: data.pairingCode || prev.pairingCode,
            user: data.user,
            lastError: data.lastError,
            connectedAt: data.connectedAt,
          };
        });
      }
    } catch {}
  };

  // Countdown timer for QR code validity
  useEffect(() => {
    if (activeTab !== 'qr' || !statusData.qrCode || statusData.status === 'connected') return;
    const timer = setInterval(() => {
      setQrCountdown((prev) => (prev > 1 ? prev - 1 : 45));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTab, statusData.qrCode, statusData.status]);

  // Start connection once on mount
  const triggerConnect = async (force = false) => {
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/baileys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          userId: currentUser.id,
          forceRestart: force,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusData({
          status: data.status,
          qrCode: data.qrCode,
          pairingCode: data.pairingCode,
          user: data.user,
          lastError: data.lastError,
        });
      } else {
        setFeedbackMsg({ type: 'error', text: data.message || 'Gagal memulai koneksi' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Koneksi jaringan terputus' });
    } finally {
      setLoading(false);
    }
  };

  // Request 8-digit pairing code
  const handleRequestPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      setFeedbackMsg({ type: 'error', text: 'Masukkan nomor WhatsApp valid (contoh: 6281234567890)' });
      return;
    }

    setLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/baileys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pair',
          userId: currentUser.id,
          phone: cleanPhone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusData((prev) => ({
          ...prev,
          pairingCode: data.pairingCode,
          status: 'pairing',
        }));
      } else {
        setFeedbackMsg({ type: 'error', text: data.message || 'Gagal generate pairing code' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Gagal menghubungi server' });
    } finally {
      setLoading(false);
    }
  };

  // Disconnect / logout
  const handleDisconnect = async () => {
    if (!confirm('Apakah yakin ingin memutuskan akun WhatsApp ini?')) return;
    setLoading(true);
    try {
      await fetch('/api/baileys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      setStatusData({
        status: 'disconnected',
        qrCode: null,
        pairingCode: null,
        user: null,
        lastError: null,
      });
      setFeedbackMsg({ type: 'success', text: 'Akun WhatsApp berhasil diputuskan.' });
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Gagal memutuskan WhatsApp' });
    } finally {
      setLoading(false);
    }
  };

  // Sync profile details into current app user
  const handleSyncProfile = async () => {
    setSyncingProfile(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/baileys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_profile',
          userId: currentUser.id,
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        onProfileSynced(data.user);
        setFeedbackMsg({
          type: 'success',
          text: 'Profil berhasil disinkronkan dengan data WhatsApp asli!',
        });
      } else {
        setFeedbackMsg({ type: 'error', text: data.message || 'Gagal sinkronisasi profil' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Gagal sinkronisasi profil' });
    } finally {
      setSyncingProfile(false);
    }
  };

  // Mount effect: connect real-time SSE stream to keep lambda alive & poll backup
  useEffect(() => {
    fetchStatus();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/baileys/sse?userId=${encodeURIComponent(currentUser.id)}`);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'qr' && payload.qrCode) {
            setStatusData((prev) => ({ ...prev, status: 'qrcode', qrCode: payload.qrCode }));
            setQrCountdown(45);
          } else if (payload.type === 'connected' && payload.user) {
            setStatusData((prev) => ({
              ...prev,
              status: 'connected',
              user: payload.user,
              qrCode: null,
              pairingCode: null,
            }));
            setFeedbackMsg({
              type: 'success',
              text: `Berhasil terhubung ke WhatsApp: ${payload.user.name || payload.user.phone}!`,
            });
          } else if (payload.type === 'pairing' && payload.pairingCode) {
            setStatusData((prev) => ({ ...prev, status: 'pairing', pairingCode: payload.pairingCode }));
          } else if (payload.type === 'status' && payload.status) {
            setStatusData((prev) => ({ ...prev, status: payload.status }));
          } else if (payload.type === 'init') {
            setStatusData((prev) => ({
              status: payload.status || prev.status,
              qrCode: payload.qrCode || prev.qrCode,
              user: payload.user || prev.user,
              pairingCode: payload.pairingCode || prev.pairingCode,
              lastError: payload.lastError,
            }));
          }
        } catch {}
      };
    } catch {}

    // Backup polling every 3.5s
    pollTimerRef.current = setInterval(() => {
      fetchStatus();
    }, 3500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (eventSource) eventSource.close();
    };
  }, [currentUser.id]);

  const isConnected = statusData.status === 'connected' && Boolean(statusData.user);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-[#e9edef] dark:border-[#222e35] max-h-[92dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="h-16 px-5 bg-[#008069] dark:bg-[#1f2c34] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-[#25d366]" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Sync to Real WhatsApp</h2>
              <p className="text-[11px] text-[#e9edef]/80">
                Baileys Gateway &middot; Sambungkan WhatsApp Asli
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`mx-5 mt-3 p-3 rounded-xl text-xs flex items-center space-x-2 ${
              feedbackMsg.type === 'success'
                ? 'bg-[#00a884]/15 border border-[#00a884]/40 text-[#008069] dark:text-[#25d366]'
                : 'bg-red-500/10 border border-red-500/30 text-red-500'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Status Data Error */}
        {statusData.lastError && (
          <div className="mx-5 mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{statusData.lastError}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {isConnected ? (
            /* --- STATE: CONNECTED --- */
            <div className="space-y-4">
              <div className="bg-[#f0f2f5] dark:bg-[#111b21] rounded-2xl p-4 border border-[#00a884]/30 shadow-sm">
                <div className="flex items-center space-x-4">
                  <img
                    src={
                      statusData.user?.avatar ||
                      currentUser.avatar ||
                      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
                    }
                    alt="WhatsApp Profile"
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-[#25d366] shadow"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#25d366] animate-pulse" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#00a884] dark:text-[#25d366]">
                        Terhubung ke WhatsApp
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-[#111b21] dark:text-[#e9edef] truncate">
                      {statusData.user?.name || 'Pengguna WhatsApp'}
                    </h3>
                    <p className="text-xs font-mono text-[#8696a0]">
                      +{statusData.user?.phone}
                    </p>
                    {statusData.user?.about && (
                      <p className="text-xs text-[#54656f] dark:text-[#aebac1] truncate mt-0.5">
                        "{statusData.user?.about}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#e9edef] dark:border-[#222e35] flex items-center justify-between text-[11px] text-[#8696a0]">
                  <span className="flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" />
                    <span>Sinkronisasi Otomatis Aktif</span>
                  </span>
                  <span>Baileys Engine v7.0</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                <button
                  onClick={handleSyncProfile}
                  disabled={syncingProfile}
                  className="w-full py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white text-sm font-semibold flex items-center justify-center space-x-2 shadow disabled:opacity-50 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {syncingProfile
                      ? 'Menyinkronkan Akun...'
                      : 'Sinkronkan ke Profil Akun Web Saya'}
                  </span>
                </button>

                <p className="text-[11px] text-center text-[#8696a0]">
                  Menyalin foto profil, nama, nomor telepon, dan status dari WhatsApp asli ke akun
                  web Anda.
                </p>

                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Putuskan Hubungan (Logout WhatsApp)</span>
                </button>
              </div>
            </div>
          ) : (
            /* --- STATE: NOT CONNECTED (SCAN QR / PAIRING) --- */
            <div className="space-y-4">
              {/* Tab Selector */}
              <div className="flex bg-[#f0f2f5] dark:bg-[#111b21] p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('qr')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors ${
                    activeTab === 'qr'
                      ? 'bg-white dark:bg-[#202c33] text-[#00a884] shadow-xs'
                      : 'text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#e9edef]'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scan QR (Cloud)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('pairing')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors ${
                    activeTab === 'pairing'
                      ? 'bg-white dark:bg-[#202c33] text-[#00a884] shadow-xs'
                      : 'text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#e9edef]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Kode Pairing (8 Digit)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('gateway')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors ${
                    activeTab === 'gateway'
                      ? 'bg-white dark:bg-[#202c33] text-[#00a884] shadow-xs'
                      : 'text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#e9edef]'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Gateway PC (24/7)</span>
                </button>
              </div>

              {activeTab === 'qr' ? (
                /* QR Code Tab */
                <div className="flex flex-col items-center justify-center text-center space-y-3">
                  <div className="relative p-3 bg-white rounded-2xl shadow-md border border-[#e9edef] flex items-center justify-center min-w-[220px] min-h-[220px]">
                    {statusData.qrCode ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={statusData.qrCode}
                          alt="WhatsApp QR Code"
                          className="w-56 h-56 rounded-lg object-contain"
                        />
                        <div className="mt-2 flex items-center space-x-1.5 text-[11px] text-[#00a884] dark:text-[#25d366] font-semibold bg-[#00a884]/10 px-3 py-1 rounded-full">
                          <span className="w-2 h-2 rounded-full bg-[#25d366] animate-pulse"></span>
                          <span>QR Siap di-scan &middot; sisa {qrCountdown}s</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-[#8696a0] p-6 space-y-2">
                        <RefreshCw className="w-8 h-8 animate-spin text-[#00a884]" />
                        <span className="text-xs font-medium">
                          {statusData.status === 'connecting'
                            ? 'Menyiapkan socket WhatsApp...'
                            : 'Memuat QR Code...'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Recommendation: Pairing Code */}
                  <div className="w-full bg-[#00a884]/10 border border-[#00a884]/30 rounded-xl p-3 text-left space-y-1">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-[#008069] dark:text-[#25d366]">
                      <Smartphone className="w-4 h-4 flex-shrink-0" />
                      <span>Scan QR gagal / terburu-buru? Gunakan Kode Pairing</span>
                    </div>
                    <p className="text-[11px] text-[#54656f] dark:text-[#aebac1]">
                      Pindah ke tab <b>"Kode Pairing (8 Digit)"</b> di atas. Cukup masukkan nomor HP WhatsApp Anda, lalu ketik kode 8 digit di WhatsApp ponsel tanpa perlu kamera!
                    </p>
                  </div>

                  <div className="text-xs text-[#54656f] dark:text-[#aebac1] max-w-xs space-y-1">
                    <p className="font-semibold text-[#111b21] dark:text-[#e9edef]">
                      Cara Scan QR:
                    </p>
                    <ol className="text-left text-[11px] list-decimal list-inside space-y-0.5 text-[#8696a0]">
                      <li>Buka WhatsApp di ponsel Anda</li>
                      <li>Ketuk Menu (titik 3) atau Pengaturan</li>
                      <li>Pilih <b>Perangkat Tertaut</b> &gt; <b>Tautkan Perangkat</b></li>
                      <li>Arahkan kamera ponsel ke QR Code di atas</li>
                    </ol>
                  </div>

                  <button
                    type="button"
                    onClick={() => triggerConnect(true)}
                    disabled={loading}
                    className="px-3.5 py-1.5 rounded-lg border border-[#e9edef] dark:border-[#222e35] text-xs text-[#00a884] hover:bg-black/5 dark:hover:bg-white/5 flex items-center space-x-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>Muat Ulang QR Manual</span>
                  </button>
                </div>
              ) : activeTab === 'pairing' ? (
                /* Pairing Code Tab */
                <form onSubmit={handleRequestPairing} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#00a884] mb-1">
                      Nomor Telepon WhatsApp
                    </label>
                    <div className="flex items-center bg-[#f0f2f5] dark:bg-[#111b21] rounded-xl px-3 py-2.5 text-sm">
                      <Smartphone className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
                      <input
                        type="tel"
                        placeholder="6281234567890 (dengan kode negara)"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full bg-transparent outline-none text-[#111b21] dark:text-[#e9edef] font-mono text-xs"
                      />
                    </div>
                    <span className="text-[10px] text-[#8696a0] mt-1 block">
                      Gunakan format internasional tanpa tanda + atau spasi (contoh: 628123456789).
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !phoneNumber}
                    className="w-full py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold flex items-center justify-center space-x-1.5 shadow disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>Dapatkan Kode Pairing (8 Digit)</span>
                  </button>

                  {statusData.pairingCode && (
                    <div className="bg-[#f0f2f5] dark:bg-[#111b21] rounded-xl p-4 text-center border border-[#00a884]/40">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#8696a0] block mb-1">
                        Masukkan kode ini di ponsel Anda:
                      </span>
                      <div className="text-2xl font-mono font-bold tracking-widest text-[#00a884] dark:text-[#25d366] select-all">
                        {statusData.pairingCode}
                      </div>
                      <p className="text-[11px] text-[#8696a0] mt-2">
                        Buka WhatsApp &gt; Perangkat Tertaut &gt; Tautkan dengan nomor telepon saja.
                      </p>
                    </div>
                  )}
                </form>
              ) : (
                /* Gateway PC Tab */
                <div className="space-y-4 text-xs">
                  <div className="bg-[#f0f2f5] dark:bg-[#111b21] rounded-xl p-4 border border-[#00a884]/30 space-y-3">
                    <div className="flex items-center space-x-2 text-[#008069] dark:text-[#25d366] font-bold">
                      <Terminal className="w-4 h-4" />
                      <span>Solusi Anti Gagal: Background Gateway PC</span>
                    </div>
                    <p className="text-[#54656f] dark:text-[#aebac1] leading-relaxed">
                      Serverless cloud (Vercel) membekukan koneksi WebSocket jika HP terlambat mengirim paket handshake. Agar koneksi tidak pernah timeout dan login 100% instan:
                    </p>
                    <div className="bg-black/90 text-[#25d366] font-mono p-3 rounded-lg text-xs select-all">
                      npm run wa-gateway
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-[#8696a0] text-[11px]">
                      <li>Buka PowerShell / Command Prompt di folder komputer ini</li>
                      <li>Ketik <code className="text-[#00a884] font-bold">npm run wa-gateway</code> lalu tekan Enter</li>
                      <li>Scan QR yang muncul di terminal komputer</li>
                      <li>Selesai! Pesan WhatsApp akan tersinkron otomatis ke web ini 24/7.</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#f0f2f5] dark:bg-[#111b21] border-t border-[#e9edef] dark:border-[#222e35] flex items-center justify-between text-xs text-[#8696a0] flex-shrink-0">
          <span>Privasi & Keamanan: Enkripsi End-to-End</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#00a884]/15 hover:bg-[#00a884]/25 text-[#00a884] dark:text-[#25d366] font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
