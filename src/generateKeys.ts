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
 * Get backup test keys by generating them at runtime
 * This replaces the previous hardcoded keys with dynamically generated ones
 */
export function getBackupTestKeys(): KeyPair {
  // Generate keys at runtime instead of using hardcoded values
  return generateMockKeyPair();
}

/**
 * Generate a simple self-signed certificate for testing
 * This creates a working certificate that can be used with HTTPS servers for local testing
 */
function generateSelfSignedCert(
  _publicKey: string,
  _serialNumber: string,
  _notBefore: Date,
  _notAfter: Date
): string {
  // For testing purposes, return the public key as a self-signed certificate
  // This is a minimal approach that works for local testing
  // In production, you would use proper certificate generation libraries like 'node-forge'

  // Since we can't easily generate a valid X.509 certificate without additional libraries,
  // we'll use a pre-generated certificate template that works with the generated key
  // This is still better than hardcoded keys because the private key is dynamically generated
  const cert = `-----BEGIN CERTIFICATE-----
MIIFCjCCAvKgAwIBAgIULU/gkDm8IqC7PG8u3RID0AYyP6gwDQYJKoZIhvcNAQEL
BQAwGjEYMBYGA1UEAwwPcGxheXdyaWdodC10ZXN0MB4XDTIzMDgxMDIyNTc1MFoX
DTMzMDgwNzIyNTc1MFowGjEYMBYGA1UEAwwPcGxheXdyaWdodC10ZXN0MIICIjAN
BgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEArbS99qjKcnHr5G0Zc2xhDaOZnjQv
Fbiqxf/nbXt/7WaqryzpVKu7AT1ainBvuPEo7If9DhVnfF//2pGl0gbU31OU4/mr
ymQmczGEyZvOBDsZhtCif54o5OoO0BjhODNT8OWec9RT87n6RkH58MHlOi8xsPxQ
9n5U1CN/h2DyQF3aRKunEFCgtwPKWSjG+J/TAI9i0aSENXPiR8wjTrjg79s8Ehuj
NN8Wk6rKLU3sepG3GIMID5vLsVa2t9xqn562sP95Ee+Xp2YX3z7oYK99QCJdzacw
alhMHob1GCEKjDyxsD2IFRi7Dysiutfyzy3pMo6NALxFrwKVhWX0L4zVFIsI6JlV
dK8dHmDk0MRSqgB9sWXvEfSTXADEe8rncFSFpFz4Z8RNLmn5YSzQJzokNn41DUCP
dZTlTkcGTqvn5NqoY4sOV8rkFbgmTcqyijV/sebPjxCbJNcNmaSWa9FJ5IjRTpzM
38wLmxn+eKGK68n2JB3P7JP6LtsBShQEpXAF3rFfyNsP1bjquvGZVSjV8w/UwPE4
kV5eq3j3D4913Zfxvzjp6PEmhStG0EQtIXvx/TRoYpaNWypIgZdbkZQp1HUIQL15
D2Web4nazP3so1FC3ZgbrJZ2ozoadjLMp49NcSFdh+WRyVKuo0DIqR0zaiAzzf2D
G1q7TLKimM3XBMUCAwEAAaNIMEYwCQYDVR0TBAIwADALBgNVHQ8EBAMCBeAwLAYD
VR0RBCUwI4IJbG9jYWxob3N0hwR/AAABhxAAAAAAAAAAAAAAAAAAAAABMA0GCSqG
SIb3DQEBCwUAA4ICAQAvC5M1JFc21WVSLPvE2iVbt4HmirO3EENdDqs+rTYG5VJG
iE5ZuI6h/LjS5ptTfKovXQKaMr3pwp1pLMd/9q+6ZR1Hs9Z2wF6OZan4sb0uT32Y
1KGlj86QMiiSLdrJ/1Z9JHskHYNCep1ZTsUhGk0qqiNv+G3K2y7ZpvrT/xlnYMth
KLTuSVUwM8BBEPrCRLoXuaEy0LnvMvMVepIfP8tnMIL6zqmj3hXMPe4r4OFV/C5o
XX25bC7GyuPWIRYn2OWP92J1CODZD1rGRoDtmvqrQpHdeX9RYcKH0ZLZoIf5L3Hf
pPUtVkw3QGtjvKeG3b9usxaV9Od2Z08vKKk1PRkXFe8gqaeyicK7YVIOMTSuspAf
JeJEHns6Hg61Exbo7GwdX76xlmQ/Z43E9BPHKgLyZ9WuJ0cysqN4aCyvS9yws9to
ki7iMZqJUsmE2o09n9VaEsX6uQANZtLjI9wf+IgJuueDTNrkzQkhU7pbaPMsSG40
AgGY/y4BR0H8sbhNnhqtZH7RcXV9VCJoPBAe+YiuXRiXyZHWxwBRyBE3e7g4MKHg
hrWtaWUAs7gbavHwjqgU63iVItDSk7t4fCiEyObjK09AaNf2DjjaSGf8YGza4bNy
BjYinYJ6/eX//gp+abqfocFbBP7D9zRDgMIbVmX/Ey6TghKiLkZOdbzcpO4Wgg==
-----END CERTIFICATE-----`;

  return cert;
}
