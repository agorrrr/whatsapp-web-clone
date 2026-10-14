import { NextResponse } from 'next/server';
import { getUserFriends, addFriend } from '../../../server/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Parameter userId dibutuhkan' },
        { status: 400 }
      );
    }

    const friends = await getUserFriends(userId);
    return NextResponse.json({ success: true, friends });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal mengambil daftar teman' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, friendUsernameOrId } = body;

    if (!userId || !friendUsernameOrId) {
      return NextResponse.json(
        { success: false, message: 'userId dan friendUsernameOrId wajib diisi' },
        { status: 400 }
      );
    }

    const result = await addFriend(userId, friendUsernameOrId);
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || 'Gagal menambah teman' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Berhasil berteman',
      friend: result.friend,
      friends: result.friends,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memproses tambah teman' },
      { status: 500 }
    );
  }
}
