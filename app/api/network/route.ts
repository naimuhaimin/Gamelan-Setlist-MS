import { NextResponse } from 'next/server';
import { getNetworkAddresses, dbManager } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const network = getNetworkAddresses();
  return NextResponse.json({
    success: true,
    lanIp: network.lanIp,
    lanUrl: network.lanUrl,
    allIps: network.allIps,
    activeSubscribers: dbManager.getSubscriberCount(),
  });
}
