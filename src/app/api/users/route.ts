import { NextResponse } from 'next/server';
import { getAllUsers } from '../../../server/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || '').toLowerCase().trim();
    const excludeId = searchParams.get('exclude') || '';
    const userId = searchParams.get('userId');

    const allUsers = await getAllUsers();

    if (userId) {
      const user = allUsers.find((u) => u.id === userId);
      return NextResponse.json({
        success: !!user,
        user: user
          ? {
              id: user.id,
              username: user.username,
              name: user.name,
              identifier: user.identifier,
              phone: user.phone,
              avatar: user.avatar,
              about: user.about,
              isOnline: user.isOnline ?? true,
              lastSeen: user.lastSeen,
              createdAt: user.createdAt,
            }
          : null,
      });
    }
    const filtered = allUsers
      .filter((u) => u.id !== excludeId)
      .filter((u) => {
        if (!query) return true;
        return (
          (u.name || '').toLowerCase().includes(query) ||
          (u.username || '').toLowerCase().includes(query) ||
          (u.identifier || '').toLowerCase().includes(query) ||
          (u.phone || '').toLowerCase().includes(query)
        );
      })
      .map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        identifier: u.identifier,
        avatar: u.avatar,
        about: u.about,
        isOnline: u.isOnline ?? true,
      }));

    return NextResponse.json({ success: true, users: filtered });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memuat user' },
      { status: 500 }
    );
  }
}
