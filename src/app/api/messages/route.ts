import { NextResponse } from 'next/server';
import {
  saveMessage,
  getMessagesBetween,
  getMessagesForUser,
  getChatRoomId,
  findUserById,
} from '../../../server/db';
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

    await saveMessage(newMsg);

    return NextResponse.json({ success: true, message: newMsg });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal mengirim pesan' },
      { status: 500 }
    );
  }
}
