/** Strip scripts, trackers, and other active content from captured HTML. */

const SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const NOSCRIPT_REGEX = /<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi;
const IFRAME_REGEX = /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi;
const TRACKER_HOSTS = [
  "google-analytics.com",
  "googletagmanager.com",
  "facebook.net",
  "hotjar.com",
  "clarity.ms",
  "segment.io",
  "mixpanel.com",
  "doubleclick.net",
];

function stripTrackerLinks(html: string): string {
  let result = html;
  for (const host of TRACKER_HOSTS) {
    const linkRegex = new RegExp(
      `<link[^>]+href=["'][^"']*${host.replace(".", "\\.")}[^"']*["'][^>]*>`,
      "gi",
    );
    result = result.replace(linkRegex, "");
  }
  return result;
}

export function sanitizeHtml(html: string): string {
  return stripTrackerLinks(html)
    .replace(SCRIPT_REGEX, "")
    .replace(NOSCRIPT_REGEX, "")
    .replace(IFRAME_REGEX, "")
    .replace(/<meta[^>]+http-equiv=["']refresh["'][^>]*>/gi, "");
}
