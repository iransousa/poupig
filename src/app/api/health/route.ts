import { NextResponse } from 'next/server';
import { ensureSchedulerStarted } from '@/lib/scheduler/in-process';

export async function GET() {
  // Health check também serve como hook pra inicializar o scheduler in-process
  ensureSchedulerStarted();
  return NextResponse.json({
    ok: true,
    service: 'poupapp',
    timestamp: new Date().toISOString(),
  });
}
