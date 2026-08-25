import * as ed from '@noble/ed25519';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { ClaimEnvelope, ClaimPayload, ClaimType } from '@/lib/types/claim';

// Required for @noble/ed25519 synchronous methods
ed.hashes.sha512 = (...m: Uint8Array[]) => {
  const hash = createHash('sha512');
  for (const item of m) {
    hash.update(item);
  }
  return new Uint8Array(hash.digest());
};

export interface AgentKeyPair {
  agentId: string;
  agentName: string;
  organizationId: string;
  organizationName: string;
  publicKey: string; // hex
  privateKey: string; // hex
}

/**
 * Generate a new Ed25519 keypair for an agent
 */
export function generateAgentKeyPair(
  agentId: string,
  agentName: string,
  organizationId: string,
  organizationName: string
): AgentKeyPair {
  const { secretKey, publicKey } = ed.keygen();
  return {
    agentId,
    agentName,
    organizationId,
    organizationName,
    publicKey: Buffer.from(publicKey).toString('hex'),
    privateKey: Buffer.from(secretKey).toString('hex'),
  };
}

/**
 * Create and sign a claim envelope
 */
export function createSignedClaim(
  claimType: ClaimType,
  payload: ClaimPayload,
  agent: AgentKeyPair,
  opts: {
    subject: string;
    sourceSystem: 'ZWAPGRID' | 'OPEN_PAYMENTS' | 'INTERNAL';
    sourceRecordRef?: string;
    sourceRetrievedAt?: string;
    correlationId: string;
    expiresAt?: string;
  }
): ClaimEnvelope {
  const claimId = uuidv4();
  const issuedAt = new Date().toISOString();

  // Create the canonical content to sign
  const contentToSign = JSON.stringify({
    claimId,
    claimType,
    issuerAgentId: agent.agentId,
    issuerOrganization: agent.organizationName,
    subject: opts.subject,
    payload,
    issuedAt,
  });

  // Hash the content for evidence
  const contentBytes = new TextEncoder().encode(contentToSign);
  const evidenceHash = createHash('sha512').update(contentBytes).digest('hex').slice(0, 64);

  // Sign with Ed25519
  const privateKeyBytes = Buffer.from(agent.privateKey, 'hex');
  const signatureBytes = ed.sign(contentBytes, privateKeyBytes);
  const signature = Buffer.from(signatureBytes).toString('hex');

  return {
    claimId,
    claimType,
    issuerAgentId: agent.agentId,
    issuerAgentName: agent.agentName,
    issuerOrganization: agent.organizationName,
    issuerOrganizationId: agent.organizationId,
    subject: opts.subject,
    payload,
    sourceSystem: opts.sourceSystem,
    sourceRecordRef: opts.sourceRecordRef ?? null,
    sourceRetrievedAt: opts.sourceRetrievedAt ?? null,
    evidenceHash,
    issuedAt,
    expiresAt: opts.expiresAt ?? null,
    correlationId: opts.correlationId,
    signature,
    signatureAlgorithm: 'Ed25519',
    verificationStatus: 'UNVERIFIED',
  };
}

/**
 * Verify a claim's Ed25519 signature
 */
export function verifyClaim(
  claim: ClaimEnvelope,
  publicKeyHex: string
): boolean {
  try {
    // Reconstruct the signed content
    const contentToVerify = JSON.stringify({
      claimId: claim.claimId,
      claimType: claim.claimType,
      issuerAgentId: claim.issuerAgentId,
      issuerOrganization: claim.issuerOrganization,
      subject: claim.subject,
      payload: claim.payload,
      issuedAt: claim.issuedAt,
    });

    const contentBytes = new TextEncoder().encode(contentToVerify);
    const signatureBytes = Buffer.from(claim.signature, 'hex');
    const publicKeyBytes = Buffer.from(publicKeyHex, 'hex');

    return ed.verify(signatureBytes, contentBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Verify a claim and return updated envelope with verification status
 */
export function verifyAndUpdateClaim(
  claim: ClaimEnvelope,
  publicKeyHex: string
): ClaimEnvelope {
  const isValid = verifyClaim(claim, publicKeyHex);
  return {
    ...claim,
    verificationStatus: isValid ? 'VERIFIED' : 'FAILED',
  };
}
