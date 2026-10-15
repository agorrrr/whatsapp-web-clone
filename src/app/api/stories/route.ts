import { NextResponse } from 'next/server';
import {
  getActiveStories,
  createStory,
  viewStory,
  deleteStory,
  readDb,
} from '../../../server/db';
import { StoryItem, UserStoryGroup } from '../../../types/chat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, message: 'userId required' }, { status: 400 });
    }

    const activeStories = await getActiveStories();
    const db = await readDb();

    // 1. Current user's active stories
    const myStories = activeStories.filter((s) => s.userId === userId);

    // 2. Friends' stories grouped by user
    const friendMap = new Map<string, StoryItem[]>();
    activeStories.forEach((s) => {
      if (s.userId !== userId) {
        if (!friendMap.has(s.userId)) {
          friendMap.set(s.userId, []);
        }
        friendMap.get(s.userId)!.push(s);
      }
    });

    const friendStories: UserStoryGroup[] = [];
    friendMap.forEach((stories, fId) => {
      const user = db.users.find((u) => u.id === fId);
      // Sort user's stories chronologically (oldest first for playback)
      const sorted = [...stories].sort((a, b) => a.createdAt - b.createdAt);
      const hasUnviewed = sorted.some((s) => !s.viewers?.includes(userId));
      const latestTimestamp = Math.max(...sorted.map((s) => s.createdAt));

      friendStories.push({
        userId: fId,
        userName: user?.name || sorted[0].userName,
        userAvatar: user?.avatar || sorted[0].userAvatar,
        hasUnviewed,
        stories: sorted,
        latestTimestamp,
      });
    });

    // Sort friend stories: unviewed first, then by latest update
    friendStories.sort((a, b) => {
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return b.latestTimestamp - a.latestTimestamp;
    });

    return NextResponse.json(
      {
        success: true,
        myStories: [...myStories].sort((a, b) => a.createdAt - b.createdAt),
        friendStories,
        totalActiveCount: activeStories.length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memuat cerita' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, userId, storyId, viewerUserId } = body;

    switch (action) {
      case 'create': {
        const { userName, userAvatar, type, mediaUrl, caption, text, backgroundColor } = body;
        if (!userId || !type) {
          return NextResponse.json(
            { success: false, message: 'userId dan type wajib diisi' },
            { status: 400 }
          );
        }

        const now = Date.now();
        const newStory: StoryItem = {
          id: `story_${now}_${Math.random().toString(36).substring(2, 6)}`,
          userId,
          userName: userName || 'Pengguna',
          userAvatar:
            userAvatar ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          type,
          mediaUrl: mediaUrl || undefined,
          caption: caption || undefined,
          text: text || undefined,
          backgroundColor: backgroundColor || '#075e54',
          createdAt: now,
          expiresAt: now + 24 * 60 * 60 * 1000, // Otomatis hangus setelah 24 jam
          viewers: [],
        };

        const created = await createStory(newStory);
        return NextResponse.json({ success: true, story: created });
      }

      case 'view': {
        if (!storyId || !viewerUserId) {
          return NextResponse.json(
            { success: false, message: 'storyId dan viewerUserId wajib diisi' },
            { status: 400 }
          );
        }
        await viewStory(storyId, viewerUserId);
        return NextResponse.json({ success: true });
      }

      case 'delete': {
        if (!storyId || !userId) {
          return NextResponse.json(
            { success: false, message: 'storyId dan userId wajib diisi' },
            { status: 400 }
          );
        }
        const deleted = await deleteStory(storyId, userId);
        return NextResponse.json({ success: deleted });
      }

      default:
        return NextResponse.json({ success: false, message: 'Action tidak dikenal' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memproses cerita' },
      { status: 500 }
    );
  }
}
