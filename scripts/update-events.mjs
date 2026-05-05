import { mkdir, writeFile } from "node:fs/promises";

const sourceUrl = "https://higashihiroshima-kanko.jp/event/";
const outputPath = new URL("../data/events.json", import.meta.url);
const maxItems = 12;

const response = await fetch(sourceUrl, {
  headers: {
    "User-Agent": "iphone-outdoor-compass/1.0 (+https://hokutoki.github.io/iphone-outdoor-compass/)",
  },
});

if (!response.ok) {
  throw new Error(`Failed to fetch event page: HTTP ${response.status}`);
}

const html = await response.text();
const items = parseHigashiruEvents(html).slice(0, maxItems);

if (!items.length) {
  throw new Error("No events were parsed from Higashiru");
}

const feed = {
  app: "外出コンパス",
  version: 1,
  source: "東広島おでかけ観光サイト「ヒガシル」",
  sourceUrl,
  fetchedAt: new Date().toISOString(),
  items,
};

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Wrote ${items.length} events to ${outputPath.pathname}`);

function parseHigashiruEvents(htmlText) {
  const blocks = htmlText.match(/<a href="https:\/\/higashihiroshima-kanko\.jp\/event\/[^"]+" class="c-post__event">[\s\S]*?<\/a>/g) || [];
  const today = getTodayInJapan();

  return blocks
    .map((block) => {
      const url = extract(block, /<a href="([^"]+)" class="c-post__event">/);
      const title = cleanText(extract(block, /<dt class="c-post__event-text-title">([\s\S]*?)<\/dt>/));
      const summary = cleanText(extract(block, /<dd class="c-post__event-text-catchcopy">([\s\S]*?)<\/dd>/));
      const area = cleanText(extract(block, /<div class="c-post__event-area"><span[^>]*>([\s\S]*?)<\/span><\/div>/));
      const status = cleanText(extract(block, /<div class="c-badge-event[^"]*"><img[^>]+alt="([^"]+)"/));
      const dateLabel = cleanDate(extract(block, /<li class="c-post__event-status-calendar c-icon-calendar">([\s\S]*?)<\/li>/));
      const location = cleanText(extract(block, /<li class="c-post__event-status-pin c-icon-pin"><span>([\s\S]*?)<\/span><\/li>/));
      const tags = [...block.matchAll(/<i>([\s\S]*?)<\/i>/g)].map((match) => cleanText(match[1])).filter(Boolean);
      const dates = extractIsoDates(dateLabel);
      const id = url.split("/").filter(Boolean).at(-1) || title;

      return {
        id,
        title,
        summary,
        url,
        dateLabel,
        startDate: dates[0] || "",
        endDate: dates[1] || dates[0] || "",
        area,
        location,
        status,
        tags,
        source: "ヒガシル",
      };
    })
    .filter((item) => item.title && item.url)
    .filter((item) => !item.endDate || item.endDate >= today)
    .sort((a, b) => {
      const aDate = a.startDate || "9999-12-31";
      const bDate = b.startDate || "9999-12-31";
      return aDate.localeCompare(bDate) || a.title.localeCompare(b.title, "ja");
    });
}

function extract(text, pattern) {
  return text.match(pattern)?.[1] || "";
}

function cleanDate(value) {
  return cleanText(value).replace(/\s*～\s*/g, " ～ ");
}

function cleanText(value) {
  return decodeEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function extractIsoDates(value) {
  return [...value.matchAll(/(\d{4})\/(\d{2})\/(\d{2})/g)].map((match) => `${match[1]}-${match[2]}-${match[3]}`);
}

function getTodayInJapan() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
