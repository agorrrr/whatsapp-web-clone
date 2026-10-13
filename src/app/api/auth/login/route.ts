import { NextResponse } from 'next/server';
import { findUserByIdentifier } from '../../../../server/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { identifier, pin } = body;

    if (!identifier || !pin) {
      return NextResponse.json(
        { success: false, message: 'Username/Email/Nomor telepon dan PIN wajib diisi!' },
        { status: 400 }
      );
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Akun tidak ditemukan. Silakan daftar terlebih dahulu!' },
        { status: 404 }
      );
    }

    if (user.pin !== pin.trim()) {
      return NextResponse.json(
        { success: false, message: 'PIN keamanan salah!' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        identifier: user.identifier,
        identifierType: user.identifierType,
        avatar: user.avatar,
        about: user.about,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal login' },
      { status: 500 }
    );
  }
}
