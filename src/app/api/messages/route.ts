import { NextResponse } from 'next/server';
import {
  saveMessage,
  getMessagesBetween,
  getMessagesForUser,
  getChatRoomId,
  findUserById,
} from '../../../server/db';
import { Message } from '../../../types/chat';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userA = searchParams.get('userA');
    const userB = searchParams.get('userB');
    const userId = searchParams.get('userId');

    if (userA && userB) {
      const msgs = getMessagesBetween(userA, userB);
      return NextResponse.json({ success: true, messages: msgs });
    }

    if (userId) {
      const msgs = getMessagesForUser(userId);
      return NextResponse.json({ success: true, messages: msgs });
    }

    return NextResponse.json(
      { success: false, message: 'Parameter userA & userB atau userId diperlukan!' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal mengambil pesan' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { senderId, recipientId, type, text, mediaUrl, audioDuration, replyTo } = body;

    if (!senderId || !recipientId) {
      return NextResponse.json(
        { success: false, message: 'senderId dan recipientId wajib ada!' },
        { status: 400 }
      );
    }

    const sender = findUserById(senderId);
    const recipient = findUserById(recipientId);

    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    const newMsg: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      chatId: getChatRoomId(senderId, recipientId),
      senderId,
      recipientId,
      senderName: sender?.name || 'User',
      type: type || 'text',
      text,
      mediaUrl,
      audioDuration,
      timestamp: timeString,
      status: 'delivered',
      replyTo,
    };

    saveMessage(newMsg);

    // If recipient is the Bot, generate auto response in background
    if (recipientId === 'usr_bot') {
      setTimeout(() => {
        const botReplyText =
          type === 'audio'
            ? 'Saya sudah mendengarkan pesan suara kamu! Suaranya jernih 👍'
            : type === 'image'
            ? 'Foto berhasil diterima! Bagus sekali 📸'
            : type === 'sticker'
            ? 'Stiker yang keren! 🔥'
            : (text || '').toLowerCase().includes('halo')
            ? 'Halo! Ada yang bisa saya bantu di WhatsApp Web Clone ini?'
            : `Pesanmu "${text || ''}" sudah tercatat di sistem chat pribadi ini!`;

        const botMsg: Message = {
          id: `msg_bot_${Date.now()}`,
          chatId: getChatRoomId(senderId, recipientId),
          senderId: 'usr_bot',
          recipientId: senderId,
          senderName: 'WhatsApp Bot Assistant 🤖',
          type: type === 'sticker' ? 'sticker' : 'text',
          text: type === 'sticker' ? undefined : botReplyText,
          mediaUrl: type === 'sticker' ? 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.webp' : undefined,
          timestamp: `${new Date().getHours().toString().padStart(2, '0')}:${new Date()
            .getMinutes()
            .toString()
            .padStart(2, '0')}`,
          status: 'read',
        };
        saveMessage(botMsg);
      }, 1000);
    }

    return NextResponse.json({ success: true, message: newMsg });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal mengirim pesan' },
      { status: 500 }
    );
  }
}
