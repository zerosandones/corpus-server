import { describe, it, expect } from "bun:test";
import { parseRequestUrl, getServerUrl, getRequestPath } from "./url";

describe("parseRequestUrl", () => {
  it("should parse a basic URL with port", () => {
    const result = parseRequestUrl("http://localhost:3000/docs/file.md");
    expect(result).toEqual({
      serverUrl: "http://localhost:3000",
      pathname: "/docs/file.md",
      fullPath: "/docs/file.md",
    });
  });

  it("should parse a URL without a port", () => {
    const result = parseRequestUrl("https://example.com/api/data");
    expect(result).toEqual({
      serverUrl: "https://example.com",
      pathname: "/api/data",
      fullPath: "/api/data",
    });
  });

  it("should include query string in fullPath but not pathname", () => {
    const result = parseRequestUrl("http://localhost:3000/search?q=hello&page=2");
    expect(result.pathname).toBe("/search");
    expect(result.fullPath).toBe("/search?q=hello&page=2");
    expect(result.serverUrl).toBe("http://localhost:3000");
  });

  it("should handle a root path", () => {
    const result = parseRequestUrl("http://localhost:8080/");
    expect(result.pathname).toBe("/");
    expect(result.fullPath).toBe("/");
    expect(result.serverUrl).toBe("http://localhost:8080");
  });

  it("should omit port 80 for http URLs (standard URL behaviour)", () => {
    const result = parseRequestUrl("http://example.com:80/path");
    expect(result.serverUrl).toBe("http://example.com");
  });

  it("should omit port 443 for https URLs (standard URL behaviour)", () => {
    const result = parseRequestUrl("https://example.com:443/path");
    expect(result.serverUrl).toBe("https://example.com");
  });

  it("should include non-standard port for https", () => {
    const result = parseRequestUrl("https://example.com:8443/secure");
    expect(result.serverUrl).toBe("https://example.com:8443");
    expect(result.pathname).toBe("/secure");
  });

  it("should handle a deeply nested path", () => {
    const result = parseRequestUrl("http://localhost:3000/a/b/c/d/e.json");
    expect(result.pathname).toBe("/a/b/c/d/e.json");
    expect(result.fullPath).toBe("/a/b/c/d/e.json");
  });
});

describe("getServerUrl", () => {
  it("should return protocol, host and port", () => {
    expect(getServerUrl("http://localhost:3000/some/path")).toBe("http://localhost:3000");
  });

  it("should return protocol and host without port when none is specified", () => {
    expect(getServerUrl("https://example.com/foo")).toBe("https://example.com");
  });

  it("should include non-standard port", () => {
    expect(getServerUrl("https://api.example.com:9000/v1/items")).toBe(
      "https://api.example.com:9000"
    );
  });

  it("should handle root URL with trailing slash", () => {
    expect(getServerUrl("http://localhost:4000/")).toBe("http://localhost:4000");
  });

  it("should omit default port 80 for http", () => {
    expect(getServerUrl("http://example.com:80/page")).toBe("http://example.com");
  });

  it("should omit default port 443 for https", () => {
    expect(getServerUrl("https://example.com:443/page")).toBe("https://example.com");
  });
});

describe("getRequestPath", () => {
  it("should return the pathname from a URL with port", () => {
    expect(getRequestPath("http://localhost:3000/docs/file.md")).toBe("/docs/file.md");
  });

  it("should return the pathname without query string", () => {
    expect(getRequestPath("http://localhost:3000/search?q=hello")).toBe("/search");
  });

  it("should return / for a root URL", () => {
    expect(getRequestPath("http://localhost:3000/")).toBe("/");
  });

  it("should return the pathname for a URL with no explicit port", () => {
    expect(getRequestPath("https://example.com/api/v2/users")).toBe("/api/v2/users");
  });

  it("should return the pathname and ignore fragments", () => {
    expect(getRequestPath("http://localhost:3000/page#section")).toBe("/page");
  });
});
