#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const targetUrl = process.argv[2];

if (!targetUrl) {
  console.error("Usage: npm run clone:run -- <url>");
  process.exit(1);
}

const withProtocol =
  targetUrl.startsWith("http://") || targetUrl.startsWith("https://")
    ? targetUrl
    : `https://${targetUrl}`;

const url = new URL(withProtocol);
const runId = `${url.hostname.replaceAll(".", "-")}-${new Date()
  .toISOString()
  .replaceAll(/[:.]/g, "-")}`;

const response = await fetch(url.toString(), { redirect: "follow" });
if (!response.ok) {
  console.error(`Fetch failed: ${response.status}`);
  process.exit(1);
}

const html = await response.text();
const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
const descriptionMatch = html.match(
  /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
);

const docsRunDir = path.join(process.cwd(), "docs", "research", "runs", runId);
await mkdir(docsRunDir, { recursive: true });

const htmlPath = path.join(docsRunDir, "source.html");
const metaPath = path.join(docsRunDir, "metadata.json");

await writeFile(htmlPath, html, "utf-8");
await writeFile(
  metaPath,
  JSON.stringify(
    {
      runId,
      sourceUrl: url.toString(),
      finalUrl: response.url,
      title: titleMatch?.[1]?.trim() ?? "Untitled",
      description: descriptionMatch?.[1]?.trim() ?? null,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  "utf-8",
);

console.log("Clone run saved:");
console.log(`- HTML: ${htmlPath}`);
console.log(`- Metadata: ${metaPath}`);
