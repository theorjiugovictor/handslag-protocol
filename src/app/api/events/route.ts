/**
 * SSE Events API Route
 * 
 * GET /api/events — Server-Sent Events stream for real-time updates
 * Each connected client subscribes to events for their organization.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { eventBus, type SettlementEvent } from '@/lib/services/event-bus';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('session_token')?.value
    || request.nextUrl.searchParams.get('token');

  if (!sessionToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Verify session
  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: { organization: true },
  });

  if (!session || !session.isActive) {
    return new Response('Invalid session', { status: 401 });
  }

  const orgId = session.organizationId;

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection event
      const connectMsg = `data: ${JSON.stringify({
        type: 'connected',
        orgId,
        orgName: session.organization.name,
        timestamp: new Date().toISOString(),
      })}\n\n`;
      controller.enqueue(encoder.encode(connectMsg));

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Listen for events targeted at this organization
      const onEvent = (event: SettlementEvent) => {
        try {
          const msg = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(msg));
        } catch {
          // Client disconnected
          cleanup();
        }
      };

      eventBus.on(`org:${orgId}`, onEvent);

      // Cleanup on close
      const cleanup = () => {
        clearInterval(heartbeatInterval);
        eventBus.off(`org:${orgId}`, onEvent);
      };

      // Handle abort signal (client disconnect)
      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
