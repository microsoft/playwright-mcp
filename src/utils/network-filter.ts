/**
 * Network filtering utilities for Playwright MCP server
 * Provides comprehensive filtering capabilities for network requests
 */

/**
 * Network request interface representing the essential data for filtering
 */
export interface NetworkRequest {
  /** Request URL */
  url: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Response status code */
  status?: number;
  /** Response status text */
  statusText?: string;
  /** Request/Response headers */
  headers: Record<string, string>;
  /** Request timestamp */
  timestamp: number;
  /** Request duration in ms */
  duration?: number;
}

/**
 * Configuration options for network request filtering
 */
export interface NetworkFilterOptions {
  /** URL patterns to include (supports regex) */
  urlPatterns?: string[];
  /** URL patterns to exclude (supports regex) */
  excludeUrlPatterns?: string[];
  /** Status code ranges to include */
  statusRanges?: Array<{ min: number; max: number }>;
  /** HTTP methods to include */
  methods?: string[];
  /** Maximum number of results to return */
  maxRequests?: number;
  /** Sort order: true for newest first, false for oldest first */
  newestFirst?: boolean;
}

/**
 * Filter network requests based on provided options
 *
 * @param requests - Array of network requests to filter
 * @param options - Filtering configuration options
 * @returns Filtered array of network requests
 */
export function filterNetworkRequests(
  requests: NetworkRequest[],
  options?: NetworkFilterOptions
): NetworkRequest[] {
  if (!requests || requests.length === 0) {
    return [];
  }

  // Set default options
  const opts: NetworkFilterOptions = {
    maxRequests: 20,
    newestFirst: true,
    ...options,
  };

  let filtered = [...requests];

  // URL pattern filtering
  filtered = applyUrlPatternFilters(filtered, opts);

  // HTTP method filtering
  if (opts.methods && opts.methods.length > 0) {
    filtered = filtered.filter((request) => {
      const method = request.method.toUpperCase();
      return opts.methods?.some((m) => m.toUpperCase() === method) ?? false;
    });
  }

  // Status range filtering
  filtered = applyStatusRangeFilters(filtered, opts);

  // Sort by timestamp
  if (filtered.length > 1) {
    filtered = sortRequestsByTimestamp(filtered, opts.newestFirst ?? true);
  }

  // Limit results
  if (opts.maxRequests && opts.maxRequests > 0) {
    filtered = filtered.slice(0, opts.maxRequests);
  }

  return filtered;
}

/**
 * Apply URL pattern-based filtering (include/exclude patterns)
 *
 * @param requests - Network requests to filter
 * @param options - Filter options containing URL patterns
 * @returns Filtered requests
 */
function applyUrlPatternFilters(
  requests: NetworkRequest[],
  options: NetworkFilterOptions
): NetworkRequest[] {
  let filtered = requests;

  // Apply include patterns
  if (options.urlPatterns && options.urlPatterns.length > 0) {
    filtered = filtered.filter((request) => {
      return (
        options.urlPatterns?.some((pattern) =>
          matchesUrlPattern(request.url, pattern)
        ) ?? false
      );
    });
  }

  // Apply exclude patterns
  if (options.excludeUrlPatterns && options.excludeUrlPatterns.length > 0) {
    filtered = filtered.filter((request) => {
      return !options.excludeUrlPatterns?.some((pattern) =>
        matchesUrlPattern(request.url, pattern)
      );
    });
  }

  return filtered;
}

/**
 * Apply status range filtering
 *
 * @param requests - Network requests to filter
 * @param options - Filter options containing status range criteria
 * @returns Filtered requests
 */
function applyStatusRangeFilters(
  requests: NetworkRequest[],
  options: NetworkFilterOptions
): NetworkRequest[] {
  if (!options.statusRanges || options.statusRanges.length === 0) {
    return requests;
  }

  return requests.filter((request) => {
    const status = request.status;
    if (status === undefined) {
      return true; // Include requests without status info
    }

    // Check if status falls within any of the specified ranges
    return (
      options.statusRanges?.some((range) => {
        return status >= range.min && status <= range.max;
      }) ?? false
    );
  });
}

/**
 * Sort requests by timestamp
 *
 * @param requests - Network requests to sort
 * @param newestFirst - True for newest first, false for oldest first
 * @returns Sorted requests
 */
function sortRequestsByTimestamp(
  requests: NetworkRequest[],
  newestFirst: boolean
): NetworkRequest[] {
  const sorted = [...requests].sort((a, b) => {
    const timestampA = a.timestamp;
    const timestampB = b.timestamp;

    if (newestFirst) {
      return timestampB - timestampA; // Descending (newest first)
    }
    return timestampA - timestampB; // Ascending (oldest first)
  });

  return sorted;
}

/**
 * Check if a URL matches a given pattern
 * Supports both regular expressions and simple string matching
 *
 * @param url - URL to test
 * @param pattern - Pattern to match against (can be regex or string)
 * @returns True if URL matches the pattern
 */
function matchesUrlPattern(url: string, pattern: string): boolean {
  if (!(pattern && url)) {
    return false;
  }

  try {
    // Try to create and test a regular expression
    const regex = new RegExp(pattern, 'i');
    return regex.test(url);
  } catch {
    // Invalid regex - fall back to substring matching
    return url.toLowerCase().includes(pattern.toLowerCase());
  }
}

/**
 * Create a filter for common HTTP status categories
 *
 * @param category - Status category ('success', 'redirect', 'client-error', 'server-error')
 * @returns NetworkFilterOptions configured for the specified category
 */
export function createStatusCategoryFilter(
  category: 'success' | 'redirect' | 'client-error' | 'server-error'
): Partial<NetworkFilterOptions> {
  switch (category) {
    case 'success':
      return { statusRanges: [{ min: 200, max: 299 }] };
    case 'redirect':
      return { statusRanges: [{ min: 300, max: 399 }] };
    case 'client-error':
      return { statusRanges: [{ min: 400, max: 499 }] };
    case 'server-error':
      return { statusRanges: [{ min: 500, max: 599 }] };
    default:
      return {};
  }
}
