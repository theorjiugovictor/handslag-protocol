/**
 * LienRegistry
 * 
 * Implements the Receivable Double-Financing Shield (TransCare fraud typology prevention).
 * When an invoice enters settlement, a cryptographic lien is registered to prevent
 * the same receivable from being pledged to multiple financiers or settled concurrently.
 * 
 * Replaces the hardcoded `false` in mandate-policy-engine.ts check #12.
 */

import { createHash } from 'crypto';
import prisma from '@/lib/db';

export interface LienRecord {
  id: string;
  invoiceNumber: string;
  creditorOrgId: string;
  creditorOrgName: string;
  lienHash: string;
  status: 'ACTIVE' | 'RELEASED' | 'EXPIRED';
  registeredAt: string;
  releasedAt: string | null;
  negotiationId: string | null;
}

/**
 * Generate a deterministic lien hash for an invoice + creditor combination
 */
export function computeLienHash(invoiceNumber: string, creditorOrgId: string): string {
  return createHash('sha512')
    .update(`LIEN:${invoiceNumber}:${creditorOrgId}`)
    .digest('hex');
}

/**
 * Register a lien on an invoice receivable.
 * Returns the lien record, or throws if the invoice is already under active lien
 * by a DIFFERENT creditor (double-financing attempt).
 */
export async function registerLien(params: {
  invoiceNumber: string;
  creditorOrgId: string;
  creditorOrgName: string;
  negotiationId: string;
}): Promise<LienRecord> {
  const lienHash = computeLienHash(params.invoiceNumber, params.creditorOrgId);
  
  // Check for existing active liens on this invoice
  const existingLien = await prisma.receivableLien.findFirst({
    where: {
      invoiceNumber: params.invoiceNumber,
      status: 'ACTIVE',
    },
  });

  if (existingLien && existingLien.creditorOrgId !== params.creditorOrgId) {
    throw new Error(
      `[DOUBLE_FINANCING_BLOCKED] Invoice ${params.invoiceNumber} is already under active lien ` +
      `by ${existingLien.creditorOrgName} (${existingLien.creditorOrgId}). ` +
      `Cannot register competing lien for ${params.creditorOrgName}.`
    );
  }

  // If same creditor already has an active lien, return it (idempotent)
  if (existingLien && existingLien.creditorOrgId === params.creditorOrgId) {
    return {
      id: existingLien.id,
      invoiceNumber: existingLien.invoiceNumber,
      creditorOrgId: existingLien.creditorOrgId,
      creditorOrgName: existingLien.creditorOrgName,
      lienHash: existingLien.lienHash,
      status: existingLien.status as LienRecord['status'],
      registeredAt: existingLien.registeredAt.toISOString(),
      releasedAt: existingLien.releasedAt?.toISOString() ?? null,
      negotiationId: existingLien.negotiationId,
    };
  }

  // Register new lien
  const created = await prisma.receivableLien.create({
    data: {
      invoiceNumber: params.invoiceNumber,
      creditorOrgId: params.creditorOrgId,
      creditorOrgName: params.creditorOrgName,
      lienHash,
      status: 'ACTIVE',
      negotiationId: params.negotiationId,
    },
  });

  return {
    id: created.id,
    invoiceNumber: created.invoiceNumber,
    creditorOrgId: created.creditorOrgId,
    creditorOrgName: created.creditorOrgName,
    lienHash: created.lienHash,
    status: created.status as LienRecord['status'],
    registeredAt: created.registeredAt.toISOString(),
    releasedAt: null,
    negotiationId: created.negotiationId,
  };
}

/**
 * Check if an invoice has an active lien by a different creditor.
 * Returns the conflicting lien if double-financing is detected, or null if clear.
 */
export async function checkForDoubleFinancing(
  invoiceNumber: string,
  creditorOrgId: string
): Promise<LienRecord | null> {
  const conflicting = await prisma.receivableLien.findFirst({
    where: {
      invoiceNumber,
      status: 'ACTIVE',
      creditorOrgId: { not: creditorOrgId },
    },
  });

  if (!conflicting) return null;

  return {
    id: conflicting.id,
    invoiceNumber: conflicting.invoiceNumber,
    creditorOrgId: conflicting.creditorOrgId,
    creditorOrgName: conflicting.creditorOrgName,
    lienHash: conflicting.lienHash,
    status: conflicting.status as LienRecord['status'],
    registeredAt: conflicting.registeredAt.toISOString(),
    releasedAt: conflicting.releasedAt?.toISOString() ?? null,
    negotiationId: conflicting.negotiationId,
  };
}

/**
 * Release a lien (when settlement is completed or cancelled)
 */
export async function releaseLien(invoiceNumber: string, creditorOrgId: string): Promise<void> {
  await prisma.receivableLien.updateMany({
    where: {
      invoiceNumber,
      creditorOrgId,
      status: 'ACTIVE',
    },
    data: {
      status: 'RELEASED',
      releasedAt: new Date(),
    },
  });
}

/**
 * In-memory lien check for use in mandate policy engine (non-async fallback)
 * Uses a sync cache that is periodically refreshed
 */
const lienCache = new Map<string, { creditorOrgId: string; creditorOrgName: string }>();

export function checkLienSync(invoiceNumber: string, counterpartyId: string): boolean {
  const existing = lienCache.get(invoiceNumber);
  if (!existing) return false;
  return existing.creditorOrgId !== counterpartyId;
}

export function updateLienCache(invoiceNumber: string, creditorOrgId: string, creditorOrgName: string): void {
  lienCache.set(invoiceNumber, { creditorOrgId, creditorOrgName });
}

export function clearLienCache(): void {
  lienCache.clear();
}
