import { NextResponse } from 'next/server';
import { toggleStarMessage } from '../../../../server/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messageId, userId } = body;

    if (!messageId || !userId) {
      return NextResponse.json(
        { success: false, message: 'messageId dan userId wajib diisi' },
        { status: 400 }
      );
    }

    const result = await toggleStarMessage(messageId, userId);
    if (!result) {
      return NextResponse.json(
        { success: false, message: 'Pesan tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      isStarred: result.isStarred,
      message: result.message,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal mengubah bintang pesan' },
      { status: 500 }
    );
  }
}
