'use client';

import React from 'react';
import { Lock, Laptop } from 'lucide-react';

export const EmptyChat: React.FC = () => {
  return (
    <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-[#222e35] border-b-8 border-[#00a884] p-8 text-center select-none">
      <div className="w-64 h-64 mb-6 rounded-full bg-[#f8f9fa] dark:bg-[#111b21] flex items-center justify-center shadow-inner">
        <Laptop className="w-32 h-32 text-[#aebac1] stroke-[1.2]" />
      </div>

      <h1 className="text-3xl font-light text-[#41525d] dark:text-[#e9edef] mb-3">
        Ini Bukan Whatsapp
      </h1>

      <p className="text-sm text-[#667781] dark:text-[#8696a0] max-w-md leading-relaxed mb-10">
        Kirim dan terima pesan teks, foto, rekaman suara, dan stiker secara realtime.
        Tampilan dan interaksi dirancang presisi di aplikasi Ini Bukan Whatsapp.
      </p>

      <div className="flex items-center text-xs text-[#8696a0] space-x-1.5 mt-auto">
        <Lock className="w-3.5 h-3.5" />
        <span>Terenkripsi secara end-to-end</span>
      </div>
    </div>
  );
};
