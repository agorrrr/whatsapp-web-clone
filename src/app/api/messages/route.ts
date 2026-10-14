import { NextResponse } from 'next/server';
import {
  saveMessage,
  getMessagesBetween,
  getMessagesForUser,
  getChatRoomId,
  findUserById,
} from '../../../server/db';
import { sendWhatsAppMessage } from '../../../server/baileysManager';
import { Message } from '../../../types/chat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userA = searchParams.get('userA');
    const userB = searchParams.get('userB');
    const userId = searchParams.get('userId');

    if (userA && userB) {
      const msgs = await getMessagesBetween(userA, userB);
      return NextResponse.json({ success: true, messages: msgs });
    }

    if (userId) {
      const msgs = await getMessagesForUser(userId);
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

    const sender = await findUserById(senderId);

    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    let sentToRealWa = false;

    // If recipient is a real WhatsApp contact (starts with wa_), forward to WhatsApp
    if (recipientId.startsWith('wa_') && text) {
      // 1. Try local Gateway (http://127.0.0.1:3001/send)
      try {
        const gwRes = await fetch('http://127.0.0.1:3001/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: recipientId, text }),
          signal: AbortSignal.timeout(2000),
        });
        const gwData = await gwRes.json();
        if (gwData.success) {
          sentToRealWa = true;
        }
      } catch {
        // Gateway offline or running on another host; background queue will pick it up
      }

      // 2. Try in-memory Baileys socket if available on server
      if (!sentToRealWa) {
        try {
          const sent = await sendWhatsAppMessage(recipientId.replace(/^wa_/, ''), text);
          if (sent) sentToRealWa = true;
        } catch {}
      }
    }

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
      status: sentToRealWa ? 'sent' : 'delivered',
      replyTo,
      sentToRealWa,
    };

    await saveMessage(newMsg);

    return NextResponse.json({ success: true, message: newMsg });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal mengirim pesan' },
      { status: 500 }
    );
  }
}
