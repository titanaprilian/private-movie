export type HttpMethod =
  'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface MockRequestContext {
  url: URL;
  pathname: string;
  method: string;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Headers;
  init?: RequestInit;
  bodyJson?: unknown;
  bodyText?: string;
  json: <T = unknown>() => Promise<T>;
  text: () => Promise<string>;
}

export type MockResponseData =
  | Response
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

export type MockHandler = (
  ctx: MockRequestContext
) => MockResponseData | Promise<MockResponseData>;

export interface MockRoute {
  id: string;
  method: string;
  matcher: (
    pathname: string,
    url: URL,
    method: string
  ) => { matched: boolean; params: Record<string, string> };
  handler: MockHandler;
  status: number;
}

export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

export function errorResponse(
  message: string,
  status = 400,
  extra?: Record<string, unknown>
): Response {
  return jsonResponse({ error: { message, ...extra } }, { status });
}

function parsePathPattern(pattern: string): {
  regex: RegExp;
  paramNames: string[];
} {
  const paramNames: string[] = [];
  // Normalize leading slash
  const normalized = pattern.startsWith('/') ? pattern : `/${pattern}`;
  const regexStr = normalized
    .replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    })
    .replace(/\*/g, '.*');

  return {
    regex: new RegExp(`^${regexStr}$`),
    paramNames,
  };
}

class MockFetchServer {
  private routes: MockRoute[] = [];
  private originalFetch: typeof globalThis.fetch | null = null;
  public requests: Array<{
    url: URL;
    pathname: string;
    method: string;
    bodyJson?: unknown;
    bodyText?: string;
    headers: Headers;
  }> = [];

  public start(): void {
    if (this.originalFetch === null) {
      this.originalFetch = globalThis.fetch;
      globalThis.fetch = this.handleFetch.bind(this) as typeof globalThis.fetch;
    }
  }

  public restore(): void {
    if (this.originalFetch !== null) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }
    this.reset();
  }

  public reset(): void {
    this.routes = [];
    this.requests = [];
  }

  public use(
    method: string,
    path:
      | string
      | RegExp
      | ((pathname: string, url: URL, method: string) => boolean),
    handler: MockHandler | MockResponseData,
    status = 200
  ): () => void {
    this.start();
    const id = Math.random().toString(36).substring(2);
    const upperMethod = method.toUpperCase();

    let matcher: (
      pathname: string,
      url: URL,
      m: string
    ) => { matched: boolean; params: Record<string, string> };

    if (typeof path === 'function') {
      matcher = (pathname, url, m) => ({
        matched:
          (upperMethod === '*' || upperMethod === m) && path(pathname, url, m),
        params: {},
      });
    } else if (path instanceof RegExp) {
      matcher = (pathname, _url, m) => {
        if (upperMethod !== '*' && upperMethod !== m)
          return { matched: false, params: {} };
        const match = path.exec(pathname);
        return {
          matched: match !== null,
          params: match?.groups ?? {},
        };
      };
    } else {
      // Path string: check if it contains :params
      if (path.includes(':')) {
        const { regex, paramNames } = parsePathPattern(path);
        matcher = (pathname, _url, m) => {
          if (upperMethod !== '*' && upperMethod !== m)
            return { matched: false, params: {} };
          // Strip /api prefix if matcher path doesn't have it, or vice versa
          let pathToTest = pathname;
          if (!path.startsWith('/api') && pathname.startsWith('/api')) {
            pathToTest = pathname.replace(/^\/api/, '');
          }
          const match = regex.exec(pathToTest);
          if (!match) return { matched: false, params: {} };
          const params: Record<string, string> = {};
          paramNames.forEach((name, idx) => {
            params[name] = match[idx + 1] ?? '';
          });
          return { matched: true, params };
        };
      } else {
        matcher = (pathname, _url, m) => {
          if (upperMethod !== '*' && upperMethod !== m)
            return { matched: false, params: {} };
          const normPath = path.startsWith('/') ? path : `/${path}`;
          const matched =
            pathname === normPath ||
            pathname === `/api${normPath}` ||
            pathname.endsWith(normPath) ||
            pathname.includes(normPath);
          return { matched, params: {} };
        };
      }
    }

    const routeHandler: MockHandler =
      typeof handler === 'function' ? (handler as MockHandler) : () => handler;

    const route: MockRoute = {
      id,
      method: upperMethod,
      matcher,
      handler: routeHandler,
      status,
    };

    // Unshift so newer routes take precedence
    this.routes.unshift(route);

    return () => {
      this.routes = this.routes.filter((r) => r.id !== id);
    };
  }

  public get(
    path:
      | string
      | RegExp
      | ((pathname: string, url: URL, method: string) => boolean),
    handler: MockHandler | MockResponseData,
    status = 200
  ) {
    return this.use('GET', path, handler, status);
  }

  public post(
    path:
      | string
      | RegExp
      | ((pathname: string, url: URL, method: string) => boolean),
    handler: MockHandler | MockResponseData,
    status = 200
  ) {
    return this.use('POST', path, handler, status);
  }

  public put(
    path:
      | string
      | RegExp
      | ((pathname: string, url: URL, method: string) => boolean),
    handler: MockHandler | MockResponseData,
    status = 200
  ) {
    return this.use('PUT', path, handler, status);
  }

  public patch(
    path:
      | string
      | RegExp
      | ((pathname: string, url: URL, method: string) => boolean),
    handler: MockHandler | MockResponseData,
    status = 200
  ) {
    return this.use('PATCH', path, handler, status);
  }

  public delete(
    path:
      | string
      | RegExp
      | ((pathname: string, url: URL, method: string) => boolean),
    handler: MockHandler | MockResponseData,
    status = 200
  ) {
    return this.use('DELETE', path, handler, status);
  }

  public lastRequest() {
    return this.requests[this.requests.length - 1];
  }

  private async handleFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    // Parse URL with fallback origin for relative paths
    const url = new URL(rawUrl, 'http://localhost:3000');
    const method = (
      init?.method ??
      (typeof input === 'object' && 'method' in input ? input.method : 'GET') ??
      'GET'
    ).toUpperCase();
    const pathname = url.pathname;

    let bodyText: string | undefined;
    let bodyJson: unknown | undefined;

    if (init?.body) {
      if (typeof init.body === 'string') {
        bodyText = init.body;
        try {
          bodyJson = JSON.parse(init.body);
        } catch {
          // not json
        }
      }
    }

    const headers = new Headers(init?.headers);
    this.requests.push({
      url,
      pathname,
      method,
      bodyJson,
      bodyText,
      headers,
    });

    const query: Record<string, string> = {};
    url.searchParams.forEach((val, key) => {
      query[key] = val;
    });

    for (const route of this.routes) {
      const { matched, params } = route.matcher(pathname, url, method);
      if (matched) {
        const ctx: MockRequestContext = {
          url,
          pathname,
          method,
          params,
          query,
          headers,
          init,
          bodyJson,
          bodyText,
          json: async () => {
            if (bodyJson !== undefined) return bodyJson;
            if (bodyText !== undefined) {
              return JSON.parse(bodyText);
            }
            return undefined;
          },
          text: async () => bodyText ?? '',
        };

        const result = await route.handler(ctx);
        if (result instanceof Response) {
          return result;
        }
        return jsonResponse(result, { status: route.status });
      }
    }

    // If unhandled, return 404 or throw friendly error
    console.warn(
      `[mockFetch] Unhandled request: ${method} ${pathname}${url.search}`
    );
    return new Response(
      JSON.stringify({
        error: { message: `Unhandled request: ${method} ${pathname}` },
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export const mockFetch = new MockFetchServer();
