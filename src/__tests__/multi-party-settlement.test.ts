import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '@/lib/db';
import {
  registerLien,
  checkForDoubleFinancing,
  releaseLien,
  checkLienSync,
  updateLienCache,
  clearLienCache,
} from '@/lib/services/lien-registry';
import { NegotiationService } from '@/lib/services/negotiation-service';
import { eventBus, emitSettlementEvent } from '@/lib/services/event-bus';
import { RealOpenPaymentsAdapter } from '@/lib/adapters/real-open-payments-adapter';

describe('Multi-Party Settlement & Double-Financing Shield Tests', () => {
  beforeEach(async () => {
    clearLienCache();
    await prisma.receivableLien.deleteMany();
    await prisma.negotiation.deleteMany();
    await prisma.session.deleteMany();
  });

  describe('1. Double-Financing Shield (Lien Registry)', () => {
    it('successfully registers an active lien on an invoice receivable', async () => {
      const lien = await registerLien({
        invoiceNumber: 'INV-TEST-001',
        creditorOrgId: 'org-nordic',
        creditorOrgName: 'Nordic Components AB',
        negotiationId: 'neg-1',
      });

      expect(lien).toBeDefined();
      expect(lien.status).toBe('ACTIVE');
      expect(lien.invoiceNumber).toBe('INV-TEST-001');
      expect(lien.creditorOrgId).toBe('org-nordic');
    });

    it('allows idempotent re-registration by the SAME creditor', async () => {
      await registerLien({
        invoiceNumber: 'INV-TEST-002',
        creditorOrgId: 'org-nordic',
        creditorOrgName: 'Nordic Components AB',
        negotiationId: 'neg-2',
      });

      const secondAttempt = await registerLien({
        invoiceNumber: 'INV-TEST-002',
        creditorOrgId: 'org-nordic',
        creditorOrgName: 'Nordic Components AB',
        negotiationId: 'neg-2',
      });

      expect(secondAttempt.status).toBe('ACTIVE');
      expect(secondAttempt.creditorOrgId).toBe('org-nordic');
    });

    it('blocks double-financing when a DIFFERENT creditor tries to pledge the same invoice', async () => {
      await registerLien({
        invoiceNumber: 'INV-TEST-003',
        creditorOrgId: 'org-nordic',
        creditorOrgName: 'Nordic Components AB',
        negotiationId: 'neg-3',
      });

      await expect(
        registerLien({
          invoiceNumber: 'INV-TEST-003',
          creditorOrgId: 'org-rogue-fintech',
          creditorOrgName: 'Rogue Factor AB',
          negotiationId: 'neg-fraud',
        })
      ).rejects.toThrow(/DOUBLE_FINANCING_BLOCKED/);
    });

    it('detects conflicting liens via checkForDoubleFinancing', async () => {
      await registerLien({
        invoiceNumber: 'INV-TEST-004',
        creditorOrgId: 'org-nordic',
        creditorOrgName: 'Nordic Components AB',
        negotiationId: 'neg-4',
      });

      const conflict = await checkForDoubleFinancing('INV-TEST-004', 'org-other');
      expect(conflict).not.toBeNull();
      expect(conflict?.creditorOrgId).toBe('org-nordic');

      const noConflictForOwner = await checkForDoubleFinancing('INV-TEST-004', 'org-nordic');
      expect(noConflictForOwner).toBeNull();
    });

    it('releases a lien upon completion', async () => {
      await registerLien({
        invoiceNumber: 'INV-TEST-005',
        creditorOrgId: 'org-nordic',
        creditorOrgName: 'Nordic Components AB',
        negotiationId: 'neg-5',
      });

      await releaseLien('INV-TEST-005', 'org-nordic');

      const conflictAfterRelease = await checkForDoubleFinancing('INV-TEST-005', 'org-other');
      expect(conflictAfterRelease).toBeNull();
    });

    it('sync lien cache detects conflicting claims synchronously in mandate engine', () => {
      updateLienCache('INV-SYNC-1', 'org-nordic', 'Nordic Components AB');
      
      const isConflictingForNordic = checkLienSync('INV-SYNC-1', 'org-nordic');
      expect(isConflictingForNordic).toBe(false);

      const isConflictingForRogue = checkLienSync('INV-SYNC-1', 'org-rogue');
      expect(isConflictingForRogue).toBe(true);
    });
  });

  describe('2. Negotiation State Machine (FSM)', () => {
    it('validates permitted state transitions', () => {
      expect(NegotiationService.validateTransition('EVIDENCE_REQUESTED', 'SUPPLIER_EVIDENCE_PRESENTED')).toBe(true);
      expect(NegotiationService.validateTransition('SUPPLIER_EVIDENCE_PRESENTED', 'BUYER_MATCH_PENDING')).toBe(true);
      expect(NegotiationService.validateTransition('INITIAL_PROPOSAL', 'COUNTERPROPOSAL')).toBe(true);
      expect(NegotiationService.validateTransition('INITIAL_PROPOSAL', 'AGREEMENT_REACHED')).toBe(true);
      expect(NegotiationService.validateTransition('COMPLETED', 'INITIAL_PROPOSAL')).toBe(false);
      expect(NegotiationService.validateTransition('REJECTED', 'PAYMENT_INITIATED')).toBe(false);
    });
  });

  describe('3. Real-Time Event Bus', () => {
    it('emits and receives events on org-scoped channel', () => {
      return new Promise<void>((resolve) => {
        const targetOrg = 'org-listener-1';
        eventBus.once(`org:${targetOrg}`, (event) => {
          expect(event.type).toBe('negotiation:updated');
          expect(event.negotiationId).toBe('neg-999');
          expect(event.targetOrgId).toBe(targetOrg);
          resolve();
        });

        emitSettlementEvent({
          type: 'negotiation:updated',
          negotiationId: 'neg-999',
          targetOrgId: targetOrg,
          sourceOrgId: 'org-sender',
          payload: { status: 'OK' },
        });
      });
    });
  });

  describe('4. Token Cache Singleton in Open Payments Adapter', () => {
    it('adapter instances share the singleton token cache', async () => {
      const adapter1 = new RealOpenPaymentsAdapter();
      const token1 = await adapter1.getAccessToken();
      expect(token1).toBeDefined();

      const adapter2 = new RealOpenPaymentsAdapter();
      const token2 = await adapter2.getAccessToken();
      expect(token2).toBe(token1);
    });
  });
});
