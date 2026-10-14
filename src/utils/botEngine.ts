import { Contact, Message, MessageType } from '../types/chat';

export function generateBotReply(
  contact: Contact,
  userMessage: Message
): { text?: string; type: MessageType; mediaUrl?: string; delayMs: number } {
  const content = (userMessage.text || '').toLowerCase().trim();

  // If chat with Bot Assistant
  if (contact.id === 'c6') {
    if (content.includes('halo') || content.includes('hai')) {
      return {
        text: 'Halo! Ada yang bisa saya bantu? Kamu bisa coba kirim foto, rekam suara mic (VN), atau kirim stiker!',
        type: 'text',
        delayMs: 1200,
      };
    }
    if (content.includes('fitur') || content.includes('apa aja')) {
      return {
        text: 'Fitur Ini Bukan Whatsapp ini meliputi:\n1. Chat teks & emoji lengkap\n2. Kirim gambar & foto\n3. Rekam pesan suara (Voice Note) dengan mic browser\n4. Kirim stiker interaktif\n5. Mode Terang & Gelap (Dark Mode)\n6. Status online & indikator mengetik realtime',
        type: 'text',
        delayMs: 1500,
      };
    }
    if (userMessage.type === 'audio') {
      return {
        text: 'Saya sudah mendengarkan rekaman suara kamu! Kualitas audionya jernih 👍',
        type: 'text',
        delayMs: 1600,
      };
    }
    if (userMessage.type === 'image') {
      return {
        text: 'Foto berhasil diterima! Resolusinya bagus banget.',
        type: 'text',
        delayMs: 1400,
      };
    }
    if (userMessage.type === 'sticker') {
      return {
        type: 'sticker',
        mediaUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.webp',
        delayMs: 1200,
      };
    }
    return {
      text: `Pesanmu "${userMessage.text || 'media'}" diterima! Sistem berjalan normal dan siap digunakan.`,
      type: 'text',
      delayMs: 1300,
    };
  }

  // If chat with Budi
  if (contact.id === 'c1') {
    if (userMessage.type === 'audio') {
      return {
        text: 'Siap bro, udah gw dengerin VN lu. Nanti kita bahas lagi pas meet ya!',
        type: 'text',
        delayMs: 1800,
      };
    }
    if (userMessage.type === 'image') {
      return {
        text: 'Mantap bro, langsung gw save ya!',
        type: 'text',
        delayMs: 1500,
      };
    }
    if (userMessage.type === 'sticker') {
      return {
        type: 'sticker',
        mediaUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.webp',
        delayMs: 1300,
      };
    }
    const budiReplies = [
      'Siap aman bro, nanti kabarin lagi ya!',
      'Oke mantap, gw lagi otw kantor nih.',
      'Sip! Nanti siang kita makan bareng sekalian ngobrolin itu.',
      'Boleh tuh, atur aja waktunya.',
    ];
    return {
      text: budiReplies[Math.floor(Math.random() * budiReplies.length)],
      type: 'text',
      delayMs: 1500,
    };
  }

  // If chat with Siti
  if (contact.id === 'c2') {
    if (userMessage.type === 'audio') {
      return {
        text: 'Iyaaa aku dengerin kok hehe, suaramu jelas banget ❤️',
        type: 'text',
        delayMs: 1700,
      };
    }
    if (userMessage.type === 'image') {
      return {
        text: 'Bagus banget fotonyaa! Suka deh 😍',
        type: 'text',
        delayMs: 1400,
      };
    }
    if (userMessage.type === 'sticker') {
      return {
        type: 'sticker',
        mediaUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f970/512.webp',
        delayMs: 1200,
      };
    }
    const sitiReplies = [
      'Okeee, nanti kabarin kalau udah selesai yaa!',
      'Hehe iya bener banget ❤️',
      'Siap! Jangan lupa jaga kesehatan ya.',
      'Nanti kita ketemuan jam berapa jadinya?',
    ];
    return {
      text: sitiReplies[Math.floor(Math.random() * sitiReplies.length)],
      type: 'text',
      delayMs: 1600,
    };
  }

  // Default fallback
  const genericReplies = [
    'Oke siap, sudah terbaca!',
    'Baik, terima kasih infonya.',
    'Sip mantap 👍',
    'Nanti saya kabari lagi kelanjutannya ya.',
  ];
  return {
    text: genericReplies[Math.floor(Math.random() * genericReplies.length)],
    type: 'text',
    delayMs: 1500,
  };
}
