import { NextResponse } from 'next/server';
import {
  createGroup,
  getGroupById,
  getUserGroups,
  updateGroupInfo,
  addGroupMembers,
  removeGroupMember,
  toggleGroupAdmin,
  getGroupMembersDetails,
} from '../../../server/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const groupId = searchParams.get('groupId');

    if (groupId) {
      const group = await getGroupById(groupId);
      if (!group) {
        return NextResponse.json({ success: false, message: 'Grup tidak ditemukan' }, { status: 404 });
      }
      const members = await getGroupMembersDetails(groupId);
      return NextResponse.json({ success: true, group, members });
    }

    if (userId) {
      const groups = await getUserGroups(userId);
      return NextResponse.json({ success: true, groups });
    }

    return NextResponse.json(
      { success: false, message: 'Parameter userId atau groupId diperlukan' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memuat grup' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, avatar, creatorId, memberIds } = body;

    if (!name || !creatorId) {
      return NextResponse.json(
        { success: false, message: 'Nama grup dan pembuat grup (creatorId) wajib diisi' },
        { status: 400 }
      );
    }

    const group = await createGroup({
      name,
      description,
      avatar,
      creatorId,
      memberIds: Array.isArray(memberIds) ? memberIds : [],
    });

    const members = await getGroupMembersDetails(group.id);
    return NextResponse.json({ success: true, group, members });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal membuat grup' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { action, groupId, userId, updates, newMemberIds, targetMemberId } = body;

    if (!groupId || !userId) {
      return NextResponse.json(
        { success: false, message: 'groupId dan userId wajib disertakan' },
        { status: 400 }
      );
    }

    let updatedGroup = null;

    if (action === 'update_info') {
      updatedGroup = await updateGroupInfo(groupId, userId, updates || {});
    } else if (action === 'add_members') {
      updatedGroup = await addGroupMembers(groupId, userId, newMemberIds || []);
    } else if (action === 'remove_member' || action === 'leave_group') {
      updatedGroup = await removeGroupMember(groupId, userId, targetMemberId || userId);
    } else if (action === 'toggle_admin') {
      updatedGroup = await toggleGroupAdmin(groupId, userId, targetMemberId);
    } else {
      return NextResponse.json(
        { success: false, message: 'Aksi (action) tidak dikenali' },
        { status: 400 }
      );
    }

    const members = updatedGroup ? await getGroupMembersDetails(groupId) : [];
    return NextResponse.json({ success: true, group: updatedGroup, members });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memproses perubahan grup' },
      { status: 400 }
    );
  }
}
