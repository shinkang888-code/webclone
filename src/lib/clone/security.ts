import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF guard: refuse URLs that resolve to loopback, link-local,
 * or private network addresses so the clone runner can't be used
 * to probe the host's internal network.
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("::ffff:")) {
    return isPrivateIPv4(lower.slice("::ffff:".length));
  }
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
}

export async function assertPublicUrl(target: URL): Promise<void> {
  const hostname = target.hostname.replace(/^\[|\]$/g, "");

  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new Error("내부 주소(localhost)는 스캔할 수 없어요.");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error("사설 네트워크 IP는 스캔할 수 없어요.");
    }
    return;
  }

  let resolved: { address: string }[];
  try {
    resolved = await lookup(hostname, { all: true });
  } catch {
    throw new Error(
      "주소를 찾을 수 없어요. URL 철자를 확인하거나 잠시 후 다시 시도해 주세요.",
    );
  }

  for (const { address } of resolved) {
    if (isPrivateAddress(address)) {
      throw new Error("내부 네트워크로 연결되는 주소는 스캔할 수 없어요.");
    }
  }
}
