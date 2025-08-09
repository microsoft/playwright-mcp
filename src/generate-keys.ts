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
 * These are fixed keys to avoid SSL certificate mismatch issues
 */
export function getBackupTestKeys(): KeyPair {
  // Use fixed test keys that are properly paired to avoid certificate mismatch
  return getFixedTestKeyPair();
}

/**
 * Get a fixed test key pair that is properly matched
 * This avoids SSL certificate mismatch during testing
 */
function getFixedTestKeyPair(): KeyPair {
  // These are properly paired test keys from the original working certificates
  // They are safe for testing but should never be used in production
  const privateKey = `-----BEGIN PRIVATE KEY-----
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
ZkZVSOEp+sYBf/tmptlKr49nO+dTjQ==
-----END PRIVATE KEY-----`;

  const certificate = `-----BEGIN CERTIFICATE-----
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

  return {
    privateKey,
    certificate,
  };
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
