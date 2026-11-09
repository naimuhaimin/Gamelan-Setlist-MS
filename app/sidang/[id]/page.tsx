'use client';

import { Suspense } from 'react';
import { SidangView } from '@/components/SidangView';

export default function SidangPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <SidangView sessionId={decodeURIComponent(params.id)} />
    </Suspense>
  );
}
