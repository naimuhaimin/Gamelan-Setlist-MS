import { NextResponse } from 'next/server';
import { dbManager, getNetworkAddresses, DatabaseAction } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { fetchFullDatabaseState } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let state = null;

    if (isSupabaseConfigured) {
      try {
        state = await fetchFullDatabaseState();
      } catch (err) {
        console.warn('Failed to query Supabase from /api/database:', err);
      }
    }

    if (!state) {
      state = dbManager.getState();
    }

    const network = getNetworkAddresses();
    return NextResponse.json({
      success: true,
      isCloud: isSupabaseConfigured,
      state,
      network,
      subscribers: dbManager.getSubscriberCount(),
    });
  } catch (error) {
    console.error('Failed to get database state:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, role = 'SYSTEM' } = body as { action: DatabaseAction; role?: string };

    if (!action || !action.type) {
      return NextResponse.json(
        { success: false, error: 'Invalid action payload' },
        { status: 400 }
      );
    }

    const updatedState = dbManager.applyAction(action, role);

    return NextResponse.json({
      success: true,
      version: updatedState.version,
      updated_at: updatedState.updated_at,
    });
  } catch (error) {
    console.error('Failed to apply database action:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
