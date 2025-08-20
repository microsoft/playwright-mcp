import type * as playwright from 'playwright';
import { z } from 'zod';
import {
  filterNetworkRequests,
  type NetworkRequest,
} from '../utils/network-filter.js';
import { defineTabTool } from './tool.js';

const networkFilterSchema = z.object({
  urlPatterns: z.array(z.string()).optional(),
  excludeUrlPatterns: z.array(z.string()).optional(),
  statusRanges: z
    .array(
      z.object({
        min: z.number(),
        max: z.number(),
      })
    )
    .optional(),
  methods: z.array(z.string()).optional(),
  maxRequests: z.number().default(20),
  newestFirst: z.boolean().default(true),
});

interface NetworkFilterOptions {
  urlPatterns?: string[];
  excludeUrlPatterns?: string[];
  statusRanges?: { min: number; max: number }[];
  methods?: string[];
  maxRequests?: number;
  newestFirst?: boolean;
}

const requests = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_network_requests',
    title: 'List network requests',
    description: 'Returns all network requests since loading the page',
    inputSchema: networkFilterSchema.partial(),
    type: 'readOnly',
  },
  handle: async (tab, params, response) => {
    try {
      const requestList = await Promise.resolve(tab.requests());
      const requests = Array.from(requestList.entries());

      const filterOptions = buildFilterOptions(params);
      const result = processNetworkRequests(requests, filterOptions);

      displayFilterSummary(
        response,
        filterOptions,
        result.filteredCount,
        result.totalCount
      );
      displayResults(response, result.filteredRequests, result.totalCount);
    } catch (error) {
      response.addResult(
        `Error retrieving network requests: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

function hasFilterOptions(options: NetworkFilterOptions): boolean {
  return !!(
    options.urlPatterns?.length ||
    options.excludeUrlPatterns?.length ||
    options.statusRanges?.length ||
    options.methods?.length
  );
}

function applyFilters(
  requests: [playwright.Request, playwright.Response | null][],
  options: NetworkFilterOptions
): [playwright.Request, playwright.Response | null][] {
  return requests.filter(([request, response]) => {
    // URLパターンフィルタ
    if (options.urlPatterns?.length) {
      const url = request.url();
      const matchesPattern = options.urlPatterns.some((pattern) => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(url);
        } catch {
          // 正規表現でない場合は部分文字列マッチ
          return url.toLowerCase().includes(pattern.toLowerCase());
        }
      });
      if (!matchesPattern) return false;
    }

    // 除外URLパターンフィルタ
    if (options.excludeUrlPatterns?.length) {
      const url = request.url();
      const matchesExcludePattern = options.excludeUrlPatterns.some(
        (pattern) => {
          try {
            const regex = new RegExp(pattern, 'i');
            return regex.test(url);
          } catch {
            // 正規表現でない場合は部分文字列マッチ
            return url.toLowerCase().includes(pattern.toLowerCase());
          }
        }
      );
      if (matchesExcludePattern) return false;
    }

    // ステータスコードフィルタ
    if (options.statusRanges?.length && response) {
      const status = response.status();
      const matchesStatusRange = options.statusRanges.some(
        (range) => status >= range.min && status <= range.max
      );
      if (!matchesStatusRange) return false;
    }

    // HTTPメソッドフィルタ
    if (options.methods?.length) {
      const method = request.method().toUpperCase();
      if (!options.methods.map((m) => m.toUpperCase()).includes(method)) {
        return false;
      }
    }

    return true;
  });
}

function buildFilterOptions(params: any): NetworkFilterOptions {
  return {
    urlPatterns: params.urlPatterns,
    excludeUrlPatterns: params.excludeUrlPatterns,
    statusRanges: params.statusRanges,
    methods: params.methods,
    maxRequests: params.maxRequests ?? 20,
    newestFirst: params.newestFirst ?? true,
  };
}

function processNetworkRequests(
  requests: [playwright.Request, playwright.Response | null][],
  filterOptions: NetworkFilterOptions
) {
  const totalCount = requests.length;
  let filteredRequests = applyFilters(requests, filterOptions);

  // Apply sorting for backward compatibility
  if (hasFilterOptions(filterOptions) && filterOptions.newestFirst === false) {
    filteredRequests = filteredRequests.slice().reverse();
  }

  // Apply max requests limit
  if (
    filterOptions.maxRequests &&
    filteredRequests.length > filterOptions.maxRequests
  ) {
    filteredRequests = filteredRequests.slice(0, filterOptions.maxRequests);
  }

  return {
    filteredRequests,
    filteredCount: filteredRequests.length,
    totalCount,
  };
}

function displayFilterSummary(
  response: any,
  filterOptions: NetworkFilterOptions,
  filteredCount: number,
  totalCount: number
) {
  if (!hasFilterOptions(filterOptions)) return;

  response.addResult(
    `Filter Summary: ${filteredCount}/${totalCount} requests match criteria`
  );

  if (filterOptions.urlPatterns?.length) {
    response.addResult(
      `  URL patterns: ${filterOptions.urlPatterns.join(', ')}`
    );
  }
  if (filterOptions.excludeUrlPatterns?.length) {
    response.addResult(
      `  Exclude URL patterns: ${filterOptions.excludeUrlPatterns.join(', ')}`
    );
  }
  if (filterOptions.statusRanges?.length) {
    response.addResult(
      `  Status ranges: ${filterOptions.statusRanges.map((r) => `${r.min}-${r.max}`).join(', ')}`
    );
  }
  if (filterOptions.methods?.length) {
    response.addResult(`  Methods: ${filterOptions.methods.join(', ')}`);
  }
  response.addResult('');
}

function displayResults(
  response: any,
  filteredRequests: [playwright.Request, playwright.Response | null][],
  totalCount: number
) {
  for (const [req, res] of filteredRequests) {
    response.addResult(renderRequest(req, res));
  }

  if (filteredRequests.length === 0 && totalCount > 0) {
    response.addResult('No requests match the specified filter criteria.');
  }
}

function renderRequest(
  request: playwright.Request,
  response: playwright.Response | null
) {
  const result: string[] = [];
  result.push(`[${request.method().toUpperCase()}] ${request.url()}`);
  if (response) {
    result.push(`=> [${response.status()}] ${response.statusText()}`);
  }
  return result.join(' ');
}

export default [requests];
