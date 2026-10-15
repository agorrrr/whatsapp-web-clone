import { NextResponse } from 'next/server';
import { getStarredMessages } from '../../../../server/db';

export const dynamic = 'force-dynamic';

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

    const starredMessages = await getStarredMessages(userId);
    return NextResponse.json({ success: true, starredMessages });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal mengambil pesan berbintang' },
      { status: 500 }
    );
  }
}
