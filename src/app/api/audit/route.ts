import { NextResponse } from 'next/server';
import { exportAuditJson, getAuditLog } from '@/lib/services/audit-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const negotiationId = searchParams.get('negotiationId');
  const format = searchParams.get('format');

  if (format === 'json') {
    const json = exportAuditJson(negotiationId ?? undefined);
    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="audit-${negotiationId ?? 'all'}-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  }

  const entries = getAuditLog(negotiationId ?? undefined);
  return NextResponse.json({ success: true, entries });
}
