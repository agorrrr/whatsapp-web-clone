import { NextResponse } from 'next/server';
import {
  readDb,
  getMessagesBetween,
  getMessagesForUser,
  getUserGroups,
} from '../../../server/db';
import { getActiveCallForUser } from '../../../server/callManager';
import { UserAccount } from '../../../types/chat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const activeContactId = searchParams.get('activeContactId');

    if (!userId) {
      return NextResponse.json({ success: false, message: 'userId required' }, { status: 400 });
    }

    const db = await readDb();

    // 1. All messages involving this user (direct or groups)
    const allUserMessages = await getMessagesForUser(userId);

    // 2. Active chat messages if activeContactId is open
    let activeMessages = [];
    if (activeContactId) {
      activeMessages = await getMessagesBetween(userId, activeContactId);
    }

    // 3. Gather sender details for any incoming direct message (including strangers)
    const senderIds = new Set<string>();
    allUserMessages.forEach((m) => {
      if (m.senderId && m.senderId !== userId && !m.chatId.startsWith('grp_')) {
        senderIds.add(m.senderId);
      }
      if (m.recipientId && m.recipientId !== userId && !m.chatId.startsWith('grp_')) {
        senderIds.add(m.recipientId);
      }
    });

    const senders: Partial<UserAccount>[] = [];
    senderIds.forEach((sId) => {
      const u = db.users.find((user) => user.id === sId);
      if (u) {
        senders.push({
          id: u.id,
          username: u.username,
          name: u.name,
          avatar: u.avatar,
          about: u.about,
          isOnline: u.isOnline ?? true,
        });
      }
    });

    // 4. Groups the user is a member of
    const groups = await getUserGroups(userId);

    return NextResponse.json(
      {
        success: true,
        activeMessages,
        allUserMessages,
        senders,
        groups,
        activeCall: await getActiveCallForUser(userId),
        serverTime: Date.now(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Sync failed' },
      { status: 500 }
    );
  }
}
