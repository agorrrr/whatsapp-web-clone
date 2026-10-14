import { NextResponse } from 'next/server';
import {
  getBaileysStatus,
  connectBaileys,
  disconnectBaileys,
  syncUserProfileToDb,
  sendWhatsAppMessage,
} from '../../../server/baileysManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const status = getBaileysStatus();
    return NextResponse.json(
      { success: true, ...status },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal mengambil status Baileys' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, userId, phone, to, text, forceRestart } = body;

    switch (action) {
      case 'connect': {
        const state = await connectBaileys({
          userId,
          forceRestart: Boolean(forceRestart),
        });
        return NextResponse.json({ success: true, ...state });
      }

      case 'pair': {
        if (!phone) {
          return NextResponse.json(
            { success: false, message: 'Nomor telepon diperlukan untuk pairing code' },
            { status: 400 }
          );
        }
        const state = await connectBaileys({
          userId,
          phoneForPairing: phone,
          forceRestart: true,
        });
        return NextResponse.json({ success: true, ...state });
      }

      case 'disconnect': {
        await disconnectBaileys();
        return NextResponse.json({ success: true, message: 'WhatsApp berhasil diputus' });
      }

      case 'sync_profile': {
        if (!userId) {
          return NextResponse.json(
            { success: false, message: 'userId diperlukan untuk sinkronisasi profil' },
            { status: 400 }
          );
        }
        const updated = await syncUserProfileToDb(userId);
        return NextResponse.json({
          success: true,
          message: 'Profil berhasil disinkronkan dari akun WhatsApp',
          user: updated,
        });
      }

      case 'send': {
        if (!to || !text) {
          return NextResponse.json(
            { success: false, message: 'Parameter to dan text wajib ada' },
            { status: 400 }
          );
        }
        await sendWhatsAppMessage(to, text);
        return NextResponse.json({ success: true, message: 'Pesan WhatsApp berhasil terkirim' });
      }

      case 'status':
      default: {
        const status = getBaileysStatus();
        return NextResponse.json({ success: true, ...status });
      }
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Operasi Baileys gagal' },
      { status: 500 }
    );
  }
}
