import { NextResponse } from 'next/server';
import { updateUserProfile } from '../../../../server/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, name, avatar, about } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID diperlukan' },
        { status: 400 }
      );
    }

    const updated = await updateUserProfile(userId, { name, avatar, about });
    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'User tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        username: updated.username,
        name: updated.name,
        identifier: updated.identifier,
        avatar: updated.avatar,
        about: updated.about,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memperbarui profil' },
      { status: 500 }
    );
  }
}
