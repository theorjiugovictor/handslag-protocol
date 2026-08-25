/**
 * Auth API Route
 * 
 * Simple company-code login for demo purposes.
 * POST /api/auth — Login with company code
 * GET /api/auth — Get current session info
 * DELETE /api/auth — Logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/db';

/**
 * POST /api/auth — Login with company code
 * Body: { companyCode: "NORDIC" | "AURORA" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyCode } = body;

    if (!companyCode || typeof companyCode !== 'string') {
      return NextResponse.json(
        { success: false, error: 'companyCode is required' },
        { status: 400 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { companyCode: companyCode.toUpperCase() },
    });

    if (!org) {
      return NextResponse.json(
        { success: false, error: `Unknown company code: ${companyCode}` },
        { status: 404 }
      );
    }

    // Deactivate any existing sessions for this org
    await prisma.session.updateMany({
      where: { organizationId: org.id, isActive: true },
      data: { isActive: false },
    });

    // Create new session
    const sessionToken = uuidv4();
    const session = await prisma.session.create({
      data: {
        organizationId: org.id,
        sessionToken,
        isActive: true,
      },
    });

    const response = NextResponse.json({
      success: true,
      session: {
        sessionToken: session.sessionToken,
        organizationId: org.id,
        organizationName: org.name,
        orgNumber: org.orgNumber,
        companyCode: org.companyCode,
        role: org.role,
      },
    });

    // Set session token as httpOnly cookie
    response.cookies.set('session_token', session.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth — Get current session info
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ success: false, authenticated: false });
    }

    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { organization: true },
    });

    if (!session || !session.isActive) {
      return NextResponse.json({ success: false, authenticated: false });
    }

    // Update last seen
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      authenticated: true,
      session: {
        sessionToken: session.sessionToken,
        organizationId: session.organization.id,
        organizationName: session.organization.name,
        orgNumber: session.organization.orgNumber,
        companyCode: session.organization.companyCode,
        role: session.organization.role,
      },
    });
  } catch (error) {
    console.error('[Auth] Session check error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth — Logout
 */
export async function DELETE(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (sessionToken) {
      await prisma.session.updateMany({
        where: { sessionToken },
        data: { isActive: false },
      });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete('session_token');
    return response;
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
