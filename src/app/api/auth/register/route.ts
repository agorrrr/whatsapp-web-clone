import { NextResponse } from 'next/server';
import {
  findUserByIdentifier,
  findUserByUsername,
  createUser,
} from '../../../../server/db';
import { UserAccount } from '../../../../types/chat';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, username, identifier, identifierType, pin, avatar, about } = body;

    if (!name || !username || !identifier || !pin) {
      return NextResponse.json(
        { success: false, message: 'Semua kolom wajib diisi!' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '').replace(/\s+/g, '');
    if (cleanUsername.length < 3) {
      return NextResponse.json(
        { success: false, message: 'Username minimal 3 karakter tanpa spasi!' },
        { status: 400 }
      );
    }

    // Check unique username
    const existingUser = await findUserByUsername(cleanUsername);
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: `Username @${cleanUsername} sudah digunakan orang lain!` },
        { status: 400 }
      );
    }

    // Check unique email/phone
    const existingId = await findUserByIdentifier(identifier);
    if (existingId) {
      return NextResponse.json(
        { success: false, message: `${identifierType === 'email' ? 'Email' : 'Nomor telepon'} sudah terdaftar!` },
        { status: 400 }
      );
    }

    const newUser: UserAccount = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUsername,
      name: name.trim(),
      identifier: identifier.trim(),
      identifierType: identifierType === 'phone' ? 'phone' : 'email',
      phone: identifierType === 'phone' ? identifier.trim() : undefined,
      pin: pin.trim(),
      avatar:
        avatar ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      about: about?.trim() || 'Ada di WhatsApp Web Clone',
      isOnline: true,
      createdAt: new Date().toISOString(),
    };

    await createUser(newUser);

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        identifier: newUser.identifier,
        identifierType: newUser.identifierType,
        avatar: newUser.avatar,
        about: newUser.about,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal mendaftar akun' },
      { status: 500 }
    );
  }
}
