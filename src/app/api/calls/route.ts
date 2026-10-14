import { NextResponse } from 'next/server';
import {
  startCallSession,
  getActiveCallForUser,
  getCallById,
  answerCallSession,
  addIceCandidate,
  endCallSession,
} from '../../../server/callManager';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const callId = searchParams.get('callId');

    if (callId) {
      const call = getCallById(callId);
      return NextResponse.json({ success: true, call });
    }

    if (userId) {
      const call = getActiveCallForUser(userId);
      return NextResponse.json({ success: true, call });
    }

    return NextResponse.json({ success: false, message: 'userId or callId required' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memuat panggilan' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, callerId, receiverId, type, callId, sdpOffer, sdpAnswer, candidate, fromUserId, reason } = body;

    switch (action) {
      case 'start': {
        if (!callerId || !receiverId || !type) {
          return NextResponse.json(
            { success: false, message: 'callerId, receiverId, dan type wajib diisi' },
            { status: 400 }
          );
        }
        const call = await startCallSession({ callerId, receiverId, type, sdpOffer });
        return NextResponse.json({ success: true, call });
      }

      case 'answer': {
        if (!callId || !sdpAnswer) {
          return NextResponse.json(
            { success: false, message: 'callId dan sdpAnswer wajib diisi' },
            { status: 400 }
          );
        }
        const call = answerCallSession(callId, sdpAnswer);
        return NextResponse.json({ success: true, call });
      }

      case 'ice': {
        if (!callId || !candidate || !fromUserId) {
          return NextResponse.json(
            { success: false, message: 'callId, candidate, and fromUserId wajib diisi' },
            { status: 400 }
          );
        }
        addIceCandidate(callId, candidate, fromUserId);
        return NextResponse.json({ success: true });
      }

      case 'end': {
        if (!callId) {
          return NextResponse.json({ success: false, message: 'callId wajib diisi' }, { status: 400 });
        }
        const call = await endCallSession(callId, reason || 'ended');
        return NextResponse.json({ success: true, call });
      }

      default:
        return NextResponse.json({ success: false, message: 'Action tidak dikenal' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memproses panggilan' },
      { status: 500 }
    );
  }
}
