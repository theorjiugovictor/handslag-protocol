import { NextResponse } from 'next/server';
import { runSuccessfulNegotiation, runRejectedProposal, stepDemo, resetDemo, getDemoState } from '@/lib/services/demo-scenario-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, config } = body;

    switch (action) {
      case 'run-success': {
        const state = await runSuccessfulNegotiation(config);
        return NextResponse.json({ success: true, state });
      }
      case 'run-rejection': {
        const state = await runRejectedProposal(config);
        return NextResponse.json({ success: true, state });
      }
      case 'step': {
        const state = await stepDemo(config);
        return NextResponse.json({ success: true, state });
      }
      case 'reset': {
        resetDemo();
        return NextResponse.json({ success: true, state: null });
      }
      case 'get-state': {
        const state = getDemoState();
        return NextResponse.json({ success: true, state });
      }
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Demo API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const state = getDemoState();
  return NextResponse.json({ success: true, state });
}
