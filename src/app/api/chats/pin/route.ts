import { NextResponse } from 'next/server';
import { togglePinChat, getUserPinnedChatIds } from '../../../../server/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, chatId } = body;

    if (!userId || !chatId) {
      return NextResponse.json(
        { success: false, message: 'userId dan chatId wajib diisi' },
        { status: 400 }
      );
    }

    const result = await togglePinChat(userId, chatId);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal mengubah pin chat' },
      { status: 400 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'userId wajib diisi' },
        { status: 400 }
      );
    }

    const pinnedChatIds = await getUserPinnedChatIds(userId);
    return NextResponse.json({ success: true, pinnedChatIds });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal mengambil pinned chats' },
      { status: 500 }
    );
  }
}
