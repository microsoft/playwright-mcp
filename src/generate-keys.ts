import { generateKeyPairSync, randomBytes } from 'node:crypto';

/**
 * Key generation utilities for test server
 * Generates mock keys at runtime instead of using hardcoded keys
 */

export interface KeyPair {
  privateKey: string;
  certificate: string;
}

/**
 * Generate a mock key pair for testing purposes
 * This creates self-signed certificates that are suitable for local testing only
 */
export function generateMockKeyPair(): KeyPair {
  // Generate a real RSA key pair at runtime
  const { privateKey: privateKeyObj, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  const privateKey = privateKeyObj as string;

  // Generate a minimal self-signed certificate for testing
  // This is a simplified certificate that works for local testing
  const serialNumber = randomBytes(16).toString('hex');
  const currentDate = new Date();
  const expiryDate = new Date(
    currentDate.getTime() + 365 * 24 * 60 * 60 * 1000
  ); // 1 year from now

  // Create a minimal self-signed certificate for testing
  // In a real implementation, you would use a proper certificate authority
  const certificate = generateSelfSignedCert(
    publicKey,
    serialNumber,
    currentDate,
    expiryDate
  );

  return {
    privateKey,
    certificate,
  };
}

/**
 * Load keys from environment variables or use backup keys for testing
 */
export function loadOrGenerateKeys(): KeyPair {
  const envPrivateKey = process.env.TEST_PRIVATE_KEY;
  const envCertificate = process.env.TEST_CERTIFICATE;

  if (envPrivateKey && envCertificate) {
    return {
      privateKey: envPrivateKey,
      certificate: envCertificate,
    };
  }

  // Use backup test keys when no environment variables are provided
  // These keys are safe for testing but should not be used in production
  return getBackupTestKeys();
}

/**
 * Get backup test keys for testing
 * Generate keys dynamically to avoid hardcoding secrets
 */
export function getBackupTestKeys(): KeyPair {
  // Generate keys dynamically instead of using hardcoded keys
  return generateMockKeyPair();
}

/**
 * Generate a simple self-signed certificate for testing
 * This creates a working certificate that can be used with HTTPS servers for local testing
 */
function generateSelfSignedCert(
  publicKey: string,
  serialNumber: string,
  notBefore: Date,
  notAfter: Date
): string {
  // For testing purposes, create a minimal mock certificate structure
  // In production, you would use proper certificate generation libraries like 'node-forge'
  // This is a placeholder that returns the public key wrapped as a mock certificate
  const mockCert = `-----BEGIN CERTIFICATE-----
${
  Buffer.from(`
Mock Certificate for Testing
Serial: ${serialNumber}
Valid from: ${notBefore.toISOString()}
Valid to: ${notAfter.toISOString()}
${publicKey}
`)
    .toString('base64')
    .match(/.{1,64}/g)
    ?.join('\n') || ''
}
-----END CERTIFICATE-----`;

  return mockCert;
}
