import { NextResponse } from 'next/server';
import { setTypingStatus } from '../../../server/typingManager';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chatId, userId, userName, isTyping } = body;

    if (!chatId || !userId) {
      return NextResponse.json(
        { success: false, message: 'chatId dan userId wajib diisi' },
        { status: 400 }
      );
    }

    setTypingStatus(chatId, userId, userName || 'Teman', !!isTyping);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal mengubah status mengetik' },
      { status: 500 }
    );
  }
}
