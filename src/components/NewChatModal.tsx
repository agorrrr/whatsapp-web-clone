'use client';

import React, { useState } from 'react';
import { Contact } from '../types/chat';
import { X, UserPlus } from 'lucide-react';

interface NewChatModalProps {
  onAddContact: (contact: Contact) => void;
  onClose: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ onAddContact, onClose }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+62 ');
  const [about, setAbout] = useState('Ada.');
  const [avatar, setAvatar] = useState(
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newContact: Contact = {
      id: `contact_${Date.now()}`,
      username: name.trim().toLowerCase().replace(/\s+/g, ''),
      name: name.trim(),
      identifier: phone.trim(),
      about: about.trim(),
      avatar,
      isOnline: true,
      unreadCount: 0,
      pinned: false,
    };

    onAddContact(newContact);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-[#e9edef] dark:border-[#222e35]">
        {/* Header */}
        <div className="h-14 px-4 bg-[#008069] dark:bg-[#202c33] text-white flex items-center justify-between border-b border-transparent dark:border-[#222e35]">
          <span className="font-semibold text-base">Mulai Chat Baru</span>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#00a884] mb-1">
              Nama Kontak
            </label>
            <input
              type="text"
              placeholder="Contoh: Rian Pratama"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg px-3 py-2 text-sm text-[#111b21] dark:text-[#e9edef] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#00a884] mb-1">
              Nomor Telepon
            </label>
            <input
              type="text"
              placeholder="+62 812-xxxx-xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg px-3 py-2 text-sm text-[#111b21] dark:text-[#e9edef] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#00a884] mb-1">
              Info Status
            </label>
            <input
              type="text"
              placeholder="Ada."
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              className="w-full bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg px-3 py-2 text-sm text-[#111b21] dark:text-[#e9edef] outline-none"
            />
          </div>

          {/* Quick Avatar options */}
          <div>
            <label className="block text-xs font-semibold text-[#00a884] mb-2">
              Pilih Avatar
            </label>
            <div className="flex space-x-3">
              {[
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
                'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
                'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
                'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
              ].map((av, idx) => (
                <img
                  key={idx}
                  src={av}
                  alt={`Option ${idx}`}
                  onClick={() => setAvatar(av)}
                  className={`w-11 h-11 rounded-full object-cover cursor-pointer ring-2 transition-all ${
                    avatar === av ? 'ring-[#00a884] scale-110' : 'ring-transparent opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-[#e9edef] dark:border-[#222e35] text-sm text-[#667781] dark:text-[#8696a0] hover:bg-black/5 dark:hover:bg-white/5"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg bg-[#00a884] hover:bg-[#008f70] text-white text-sm font-semibold flex items-center justify-center space-x-1 shadow"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              <span>Tambah Chat</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
