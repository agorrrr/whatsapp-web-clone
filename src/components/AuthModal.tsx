'use client';

import React, { useState } from 'react';
import { UserAccount } from '../types/chat';
import { User, Phone, Mail, Lock, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: UserAccount) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [identifierType, setIdentifierType] = useState<'phone' | 'email'>('phone');

  // Register form state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [avatar, setAvatar] = useState(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  );
  const [about, setAbout] = useState('Ada di WhatsApp Web Clone');

  // Login form state
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

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim().toLowerCase(),
          identifier: identifier.trim(),
          identifierType,
          pin: pin.trim(),
          avatar,
          about: about.trim(),
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
          identifier: loginIdentifier.trim(),
          pin: loginPin.trim(),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-[#e9edef] dark:border-[#222e35] my-auto max-h-[92dvh] flex flex-col">
        {/* Header */}
        <div className="bg-[#008069] dark:bg-[#1f2c34] p-5 text-white text-center flex-shrink-0">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <Sparkles className="w-6 h-6 text-[#25d366]" />
          </div>
          <h2 className="text-lg font-bold">WhatsApp Web Clone</h2>
          <p className="text-xs text-white/80 mt-0.5">
            Daftar dengan Email atau Telepon untuk mendapatkan @username
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-black/20 rounded-xl p-1 mt-4">
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
          <div className="mx-5 mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Form area */}
        <div className="p-5 overflow-y-auto flex-1">
          {mode === 'register' ? (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#00a884] mb-1">
                  Nama Lengkap
                </label>
                <div className="flex items-center bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg px-3 py-2 text-sm">
                  <User className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Nama Anda"
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
                    placeholder="username_anda"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-transparent outline-none text-[#111b21] dark:text-[#e9edef]"
                  />
                </div>
                <span className="text-[10px] text-[#8696a0] mt-0.5 block">
                  Teman mencari Anda melalui @username ini.
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
                    <Phone className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
                  ) : (
                    <Mail className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
                  )}
                  <input
                    type={identifierType === 'phone' ? 'tel' : 'email'}
                    placeholder={identifierType === 'phone' ? '+62 812-xxxx-xxxx' : 'nama@email.com'}
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
                  <Lock className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
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

              {/* Avatar options */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#00a884]">
                    Pilih Foto Profil
                  </label>
                  <label className="text-[11px] text-[#00a884] cursor-pointer hover:underline">
                    Upload Sendiri
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                  </label>
                </div>
                <div className="flex space-x-2 overflow-x-auto py-1">
                  {AVATAR_OPTIONS.map((av, i) => (
                    <img
                      key={i}
                      src={av}
                      alt={`Avatar ${i}`}
                      onClick={() => setAvatar(av)}
                      className={`w-9 h-9 rounded-full object-cover cursor-pointer ring-2 transition-all flex-shrink-0 ${
                        avatar === av ? 'ring-[#00a884] scale-110' : 'ring-transparent opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-md mt-2 disabled:opacity-50"
              >
                {loading ? (
                  <span>Mendaftarkan akun...</span>
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
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#00a884] mb-1">
                  Username / Email / Nomor Telepon
                </label>
                <div className="flex items-center bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg px-3 py-2 text-sm">
                  <User className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Contoh: @username atau email/telepon"
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
                  <Lock className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
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
                className="w-full py-2.5 rounded-lg bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-md mt-2 disabled:opacity-50"
              >
                {loading ? (
                  <span>Memverifikasi akun...</span>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    <span>Masuk Sekarang</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
