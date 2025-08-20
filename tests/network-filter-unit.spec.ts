/**
 * Unit tests for network-filter utilities
 * Testing filtering, sorting, and edge cases
 */

import { randomBytes } from 'node:crypto';
import {
  createStatusCategoryFilter,
  filterNetworkRequests,
  type NetworkFilterOptions,
  type NetworkRequest,
} from '../src/utils/network-filter.js';
import { expect, test } from './fixtures.js';

test.describe('Network Filter Unit Tests', () => {
  const createSampleRequests = (): NetworkRequest[] => [
    {
      url: 'https://api.example.com/users',
      method: 'GET',
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      timestamp: 1_640_995_200_000, // Jan 1, 2022
      duration: 150,
    },
    {
      url: 'https://api.example.com/posts',
      method: 'POST',
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'application/json' },
      timestamp: 1_640_995_260_000, // Jan 1, 2022 + 1 min
      duration: 250,
    },
    {
      url: 'https://cdn.example.com/image.png',
      method: 'GET',
      status: 404,
      statusText: 'Not Found',
      headers: { 'content-type': 'text/html' },
      timestamp: 1_640_995_320_000, // Jan 1, 2022 + 2 min
      duration: 50,
    },
    {
      url: 'https://analytics.example.com/track',
      method: 'POST',
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/json' },
      timestamp: 1_640_995_380_000, // Jan 1, 2022 + 3 min
      duration: 5000,
    },
    {
      url: 'https://api.example.com/login',
      method: 'POST',
      status: 302,
      statusText: 'Found',
      headers: { location: '/dashboard' },
      timestamp: 1_640_995_440_000, // Jan 1, 2022 + 4 min
      duration: 100,
    },
    {
      url: 'https://static.example.com/styles.css',
      method: 'GET',
      headers: { 'content-type': 'text/css' },
      timestamp: 1_640_995_500_000, // Jan 1, 2022 + 5 min
      duration: 30,
      // Note: no status for testing undefined status
    },
  ];

  test('should return all requests when no filter is applied', () => {
    const sampleRequests = createSampleRequests();
    const result = filterNetworkRequests(sampleRequests);
    expect(result).toHaveLength(6);
  });

  test('should return empty array when input is empty', () => {
    const result = filterNetworkRequests([]);
    expect(result).toHaveLength(0);
  });

  test('should handle null/undefined input gracefully', () => {
    const result = filterNetworkRequests(null as unknown as NetworkRequest[]);
    expect(result).toHaveLength(0);
  });

  test('should apply default maxRequests limit', () => {
    const sampleRequest = createSampleRequests()[0];
    const manyRequests = new Array(30).fill(sampleRequest);
    const result = filterNetworkRequests(manyRequests);
    expect(result).toHaveLength(20); // default maxRequests
  });

  test('should filter by simple string pattern', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      urlPatterns: ['api.example.com'],
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(3);
    expect(result.every((req) => req.url.includes('api.example.com'))).toBe(
      true
    );
  });

  test('should filter by regular expression pattern', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      urlPatterns: ['/users$'],
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://api.example.com/users');
  });

  test('should filter by multiple URL patterns (OR logic)', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      urlPatterns: ['api.example.com', 'cdn.example.com'],
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(4);
  });

  test('should handle invalid regex patterns gracefully', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      urlPatterns: ['[invalid-regex'],
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(0); // Falls back to substring matching
  });

  test('should exclude URLs by pattern', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      excludeUrlPatterns: ['analytics'],
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(5);
    expect(result.every((req) => !req.url.includes('analytics'))).toBe(true);
  });

  test('should handle both include and exclude patterns', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      urlPatterns: ['example.com'],
      excludeUrlPatterns: ['analytics'],
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(5);
  });

  test('should filter by single HTTP method', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      methods: ['GET'],
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(3);
    expect(result.every((req) => req.method === 'GET')).toBe(true);
  });

  test('should filter by multiple HTTP methods', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      methods: ['GET', 'POST'],
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(6);
  });

  test('should be case insensitive for methods', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      methods: ['get', 'post'],
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(6);
  });

  test('should filter by single status range', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      statusRanges: [{ min: 200, max: 299 }],
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(3); // 2 success + 1 undefined status
    const withStatus = result.filter((req) => req.status);
    expect(
      withStatus.every(
        (req) => req.status && req.status >= 200 && req.status <= 299
      )
    ).toBe(true);
  });

  test('should filter by multiple status ranges', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      statusRanges: [
        { min: 200, max: 299 },
        { min: 400, max: 499 },
      ],
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(4); // 2 success + 1 client error + 1 undefined status
  });

  test('should include requests without status when filtering by status', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      statusRanges: [{ min: 200, max: 299 }],
    };
    const result = filterNetworkRequests(sampleRequests, options);
    const withoutStatus = result.filter((req) => req.status === undefined);
    expect(withoutStatus).toHaveLength(1);
  });

  test('should apply all filters together (AND logic)', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      urlPatterns: ['api.example.com'],
      methods: ['POST'],
      statusRanges: [{ min: 200, max: 299 }],
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://api.example.com/posts');
    expect(result[0].method).toBe('POST');
    expect(result[0].status).toBe(201);
  });

  test('should sort newest first by default', () => {
    const sampleRequests = createSampleRequests();
    const result = filterNetworkRequests(sampleRequests);
    expect(result[0].timestamp).toBeGreaterThan(result[1].timestamp);
    expect(result[1].timestamp).toBeGreaterThan(result[2].timestamp);
  });

  test('should sort oldest first when specified', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      newestFirst: false,
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result[0].timestamp).toBeLessThan(result[1].timestamp);
    expect(result[1].timestamp).toBeLessThan(result[2].timestamp);
  });

  test('should limit results to maxRequests', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      maxRequests: 3,
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(3);
  });

  test('should handle maxRequests larger than available results', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      maxRequests: 100,
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(6);
  });

  test('should handle zero maxRequests', () => {
    const sampleRequests = createSampleRequests();
    const options: NetworkFilterOptions = {
      maxRequests: 0,
    };
    const result = filterNetworkRequests(sampleRequests, options);
    expect(result).toHaveLength(6); // Ignored when <= 0
  });

  test('should maintain request immutability', () => {
    const sampleRequests = createSampleRequests();
    const originalRequests = [...sampleRequests];
    const options: NetworkFilterOptions = {
      methods: ['GET'],
      newestFirst: false,
    };

    filterNetworkRequests(sampleRequests, options);

    // Original array should remain unchanged
    expect(sampleRequests).toEqual(originalRequests);
  });

  test('createStatusCategoryFilter should create success category filter', () => {
    const filter = createStatusCategoryFilter('success');
    expect(filter.statusRanges).toEqual([{ min: 200, max: 299 }]);
  });

  test('createStatusCategoryFilter should create redirect category filter', () => {
    const filter = createStatusCategoryFilter('redirect');
    expect(filter.statusRanges).toEqual([{ min: 300, max: 399 }]);
  });

  test('createStatusCategoryFilter should create client-error category filter', () => {
    const filter = createStatusCategoryFilter('client-error');
    expect(filter.statusRanges).toEqual([{ min: 400, max: 499 }]);
  });

  test('createStatusCategoryFilter should create server-error category filter', () => {
    const filter = createStatusCategoryFilter('server-error');
    expect(filter.statusRanges).toEqual([{ min: 500, max: 599 }]);
  });

  test('createStatusCategoryFilter should handle invalid category', () => {
    const filter = createStatusCategoryFilter('invalid' as 'success');
    expect(filter).toEqual({});
  });

  test('createStatusCategoryFilter should work with main filter function', () => {
    const sampleRequests = createSampleRequests();
    const successFilter = createStatusCategoryFilter('success');
    const result = filterNetworkRequests(sampleRequests, successFilter);

    expect(result).toHaveLength(3); // 2 success + 1 undefined status
    const withStatus = result.filter((req) => req.status);
    expect(
      withStatus.every(
        (req) => req.status && req.status >= 200 && req.status <= 299
      )
    ).toBe(true);
  });

  test('should handle ReDoS attack patterns safely', () => {
    const sampleRequests = createSampleRequests();
    const maliciousPattern = '(a+)+$';
    const options: NetworkFilterOptions = {
      urlPatterns: [maliciousPattern],
    };

    const start = Date.now();
    const result = filterNetworkRequests(sampleRequests, options);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000); // Should complete quickly
    expect(result).toHaveLength(0);
  });

  test('should handle large datasets efficiently', () => {
    // Create 1000 requests
    const largeDataset: NetworkRequest[] = Array.from(
      { length: 1000 },
      (_, i) => ({
        url: `https://api.example.com/resource/${i}`,
        method: i % 2 === 0 ? 'GET' : 'POST',
        status: 200 + (i % 300),
        headers: { 'content-type': 'application/json' },
        timestamp: Date.now() + i,
        duration: (randomBytes(2).readUInt16BE(0) / 0xff_ff) * 1000,
        statusText: 'OK',
      })
    );

    const start = Date.now();
    const result = filterNetworkRequests(largeDataset, {
      urlPatterns: ['api.example.com'],
      methods: ['GET'],
      statusRanges: [{ min: 200, max: 299 }],
      maxRequests: 50,
    });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100); // Should complete within 100ms
    expect(result).toHaveLength(50);
  });
});
