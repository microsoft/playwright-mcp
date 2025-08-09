# Test Server Certificates

This directory contains self-signed certificates used by the HTTPS test servers in the test suite.

## Important Security Notes

- **These certificates are for testing purposes only** and should never be used in production
- The certificates are intentionally committed to the repository as they contain no sensitive data
- They are self-signed test certificates with no real-world validity

## Certificate Files

- `cert.pem` - Self-signed test certificate (public)
- `key.pem` - Private key for the test certificate (test-only, not sensitive)

## Why These Files Exist

The Playwright test infrastructure creates HTTPS test servers to verify browser behavior with secure connections. While the MCP server itself doesn't use HTTPS (it uses stdio/SSE), the test suite needs to verify that the browser automation can handle HTTPS pages correctly.

## Security Considerations

If you need to use different certificates for testing:

1. Set environment variables:
   - `TEST_PRIVATE_KEY` - Your test private key
   - `TEST_CERTIFICATE` - Your test certificate
   
2. Or replace the `.pem` files with your own test certificates

The test server will use environment variables if provided, otherwise it falls back to reading these certificate files directly.

## SonarQube Compliance

These test certificates are explicitly marked as test-only resources and are not considered security vulnerabilities because:
1. They are never used in production code
2. They are self-signed and have no real-world validity
3. They are only loaded by test infrastructure
4. The actual MCP server doesn't use HTTPS at all