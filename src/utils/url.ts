/**
 * Extracts server URL (protocol://host:port) and path from a request
 */
export function parseRequestUrl(requestUrl: string): {
  serverUrl: string;
  pathname: string;
  fullPath: string;
} {
  const url = new URL(requestUrl);
  
  const serverUrl = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}`;
  const pathname = url.pathname;
  const fullPath = `${pathname}${url.search}`;

  return {
    serverUrl,
    pathname,
    fullPath,
  };
}

/**
 * Gets the base server URL from request (e.g., "http://localhost:3000")
 */
export function getServerUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}`;
}

/**
 * Gets the path from request (e.g., "/docs/file.md")
 */
export function getRequestPath(requestUrl: string): string {
  const url = new URL(requestUrl);
  return url.pathname;
}
