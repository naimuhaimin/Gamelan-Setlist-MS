'use client';

import { ConvoView } from '@/components/ConvoView';

export default function KonvoPage({ params }: { params: { id: string } }) {
  return <ConvoView eventId={decodeURIComponent(params.id)} />;
}
