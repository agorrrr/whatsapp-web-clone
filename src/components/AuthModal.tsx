'use client';

import React, { useState } from 'react';
import { UserAccount } from '../types/chat';
import { User, Phone, Mail, Lock, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: UserAccount) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [identifierType, setIdentifierType] = useState<'email' | 'phone'>('phone');

  // Register state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [avatar, setAvatar] = useState(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  );
  const [about, setAbout] = useState('Ada di WhatsApp Web Clone');

  // Login state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPin, setLoginPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const AVATAR_OPTIONS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  ];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          username,
          identifier,
          identifierType,
          pin,
          avatar,
          about,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.message || 'Gagal mendaftar');
      } else {
        onSuccess(data.user);
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginIdentifier,
          pin: loginPin,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.message || 'Gagal masuk');
      } else {
        onSuccess(data.user);
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoUser: string) => {
    setLoginIdentifier(demoUser);
    setLoginPin('123456');
    setMode('login');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-[#e9edef] dark:border-[#222e35] my-8">
        {/* Header */}
        <div className="bg-[#008069] dark:bg-[#1f2c34] p-6 text-white text-center">
          <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-7 h-7 text-[#25d366]" />
          </div>
          <h2 className="text-xl font-bold">WhatsApp Web Clone</h2>
          <p className="text-xs text-white/80 mt-1">
            Daftar dengan Email atau Telepon untuk mendapatkan Username & Akun Chat Pribadi
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-black/20 rounded-xl p-1 mt-5">
            <button
              onClick={() => {
                setMode('register');
                setErrorMsg('');
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'register' ? 'bg-white text-[#008069] shadow' : 'text-white/80 hover:text-white'
              }`}
            >
              Daftar Akun Baru
            </button>
            <button
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'login' ? 'bg-white text-[#008069] shadow' : 'text-white/80 hover:text-white'
              }`}
            >
              Masuk Akun
            </button>
          </div>
        </div>

        {/* Error message alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' ? (
          <form onSubmit={handleRegister} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#00a884] mb-1">
                Nama Lengkap
              </label>
              <div className="flex items-center bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg px-3 py-2 text-sm">
                <User className="w-4 h-4 text-[#8696a0] mr-2" />
                <input
                  type="text"
                  placeholder="Contoh: Reza Maulana"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent outline-none text-[#111b21] dark:text-[#e9edef]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#00a884] mb-1">
                Username Unik (ID Chat)
              </label>
              <div className="flex items-center bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg px-3 py-2 text-sm">
                <span className="text-[#8696a0] font-bold mr-1">@</span>
                <input
                  type="text"
                  placeholder="rezamaulana"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-transparent outline-none text-[#111b21] dark:text-[#e9edef]"
                />
              </div>
              <span className="text-[10px] text-[#8696a0] mt-0.5 block">
                User lain akan menghubungi Anda melalui @username ini.
              </span>
            </div>

            {/* Email or Phone switch */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#00a884]">
                  Daftar Menggunakan:
                </label>
                <div className="flex space-x-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setIdentifierType('phone')}
                    className={`font-medium ${
                      identifierType === 'phone' ? 'text-[#00a884] underline' : 'text-[#8696a0]'
                    }`}
                  >
                    Nomor Telepon
                  </button>
                  <span className="text-[#8696a0]">|</span>
                  <button
                    type="button"
                    onClick={() => setIdentifierType('email')}
                    className={`font-medium ${
                      identifierType === 'email' ? 'text-[#00a884] underline' : 'text-[#8696a0]'
                    }`}
                  >
                    Email
                  </button>
                </div>
              </div>

              <div className="flex items-center bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg px-3 py-2 text-sm">
                {identifierType === 'phone' ? (
                  <Phone className="w-4 h-4 text-[#8696a0] mr-2" />
                ) : (
                  <Mail className="w-4 h-4 text-[#8696a0] mr-2" />
                )}
                <input
                  type={identifierType === 'phone' ? 'tel' : 'email'}
                  placeholder={identifierType === 'phone' ? '+62 812-3456-7890' : 'anda@email.com'}
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-transparent outline-none text-[#111b21] dark:text-[#e9edef]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#00a884] mb-1">
                PIN Keamanan / Sandi
              </label>
              <div className="flex items-center bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg px-3 py-2 text-sm">
                <Lock className="w-4 h-4 text-[#8696a0] mr-2" />
                <input
                  type="password"
                  placeholder="Minimal 4 karakter"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-transparent outline-none text-[#111b21] dark:text-[#e9edef]"
                />
              </div>
            </div>

            {/* Avatar picker */}
            <div>
              <label className="block text-xs font-semibold text-[#00a884] mb-1.5">
                Pilih Foto Profil
              </label>
              <div className="flex space-x-2.5 overflow-x-auto py-1">
                {AVATAR_OPTIONS.map((av, i) => (
                  <img
                    key={i}
                    src={av}
                    alt={`Avatar ${i}`}
                    onClick={() => setAvatar(av)}
                    className={`w-10 h-10 rounded-full object-cover cursor-pointer ring-2 transition-all ${
                      avatar === av ? 'ring-[#00a884] scale-110' : 'ring-transparent opacity-60 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[#00a884] hover:bg-[#008f70] text-white text-sm font-semibold flex items-center justify-center space-x-2 transition-all shadow-md mt-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Mendaftarkan...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Daftar & Masuk Chat</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* LOGIN FORM */
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#00a884] mb-1">
                Username / Email / Nomor Telepon
              </label>
              <div className="flex items-center bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg px-3 py-2 text-sm">
                <User className="w-4 h-4 text-[#8696a0] mr-2" />
                <input
                  type="text"
                  placeholder="Contoh: @budi atau budi@gmail.com"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="w-full bg-transparent outline-none text-[#111b21] dark:text-[#e9edef]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#00a884] mb-1">
                PIN Keamanan
              </label>
              <div className="flex items-center bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg px-3 py-2 text-sm">
                <Lock className="w-4 h-4 text-[#8696a0] mr-2" />
                <input
                  type="password"
                  placeholder="PIN akun Anda"
                  required
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  className="w-full bg-transparent outline-none text-[#111b21] dark:text-[#e9edef]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[#00a884] hover:bg-[#008f70] text-white text-sm font-semibold flex items-center justify-center space-x-2 transition-all shadow-md mt-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Memverifikasi...</span>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  <span>Masuk Sekarang</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Quick Test Demo Accounts */}
        <div className="px-6 py-4 bg-[#f0f2f5]/50 dark:bg-[#111b21]/50 border-t border-[#e9edef] dark:border-[#222e35] text-xs">
          <span className="text-[#8696a0] font-medium block mb-2">
            Uji Coba Cepat (Akun Demo Tersedia):
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('budi')}
              className="px-2.5 py-1 bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-md text-[#111b21] dark:text-[#e9edef] hover:border-[#00a884] transition-colors"
            >
              Akun @budi (PIN: 123456)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('siti')}
              className="px-2.5 py-1 bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-md text-[#111b21] dark:text-[#e9edef] hover:border-[#00a884] transition-colors"
            >
              Akun @siti (PIN: 123456)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
