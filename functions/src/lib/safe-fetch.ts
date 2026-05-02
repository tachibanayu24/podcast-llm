/**
 * SSRF-aware fetch wrapper.
 *
 * - Rejects non-http(s) protocols
 * - Rejects private/loopback/link-local IPs and known cloud metadata hostnames
 * - Enforces timeout via AbortController
 * - Sets a default User-Agent
 *
 * NOTE: redirect: "follow" is left default. The host check applies only to the
 * initial URL; downstream redirects could in theory bounce to private IPs. For
 * a personal app this trade-off is acceptable; tighten if going multi-tenant.
 */

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_USER_AGENT = "podcast-llm/0.1";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "ip6-localhost",
  "metadata",
  "metadata.google.internal",
]);

export function isPrivateHost(host: string): boolean {
  if (!host) return true;
  const lower = host.toLowerCase();
  if (BLOCKED_HOSTS.has(lower)) return true;

  // IPv4 literal
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + GCP metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CG-NAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  // IPv6 literal (often wrapped in brackets in URLs but URL.hostname strips them)
  if (host.includes(":")) {
    if (lower === "::1") return true;
    if (lower === "::") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("ff")) return true; // multicast
    return false;
  }

  return false;
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  method?: string;
}

export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`invalid URL: ${url}`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`unsupported protocol: ${parsed.protocol}`);
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error(`disallowed host: ${parsed.hostname}`);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  if (options.signal) {
    options.signal.addEventListener("abort", () => ctrl.abort(), {
      once: true,
    });
  }

  try {
    return await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        ...(options.headers ?? {}),
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch text body with a size cap. Aborts mid-stream if exceeded.
 */
export async function safeFetchText(
  url: string,
  options: SafeFetchOptions & { maxBytes?: number } = {},
): Promise<{ ok: boolean; status: number; body: string }> {
  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024; // 10 MB default
  const res = await safeFetch(url, options);
  if (!res.ok) {
    // drain to free socket
    await res.body?.cancel();
    return { ok: false, status: res.status, body: "" };
  }

  const reader = res.body?.getReader();
  if (!reader) return { ok: true, status: res.status, body: "" };

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`response too large (>${maxBytes} bytes)`);
      }
      chunks.push(value);
    }
  }
  const body = chunks
    .map((c) => Buffer.from(c))
    .reduce((acc, c) => Buffer.concat([acc, c]), Buffer.alloc(0))
    .toString("utf8");
  return { ok: true, status: res.status, body };
}
