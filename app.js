const storageKey = "iphone-outdoor-compass-v1";
const cacheVersion = 1;
const eventFeedUrl = "./data/events.json";
const calendarScope = "https://www.googleapis.com/auth/calendar.events.readonly";
const calendarApiBaseUrl = "https://www.googleapis.com/calendar/v3";
const googleIdentityScriptUrl = "https://accounts.google.com/gsi/client";
const defaultCalendarClientId = "176925321769-f8r8ic1bvbd84tn1co66bl3ibeuqo4ai.apps.googleusercontent.com";
const defaultCalendarRangeMode = "week";
const defaultTransportMode = "car";
const calendarRangeOptions = {
  today: {
    label: "今日",
    statusLabel: "今日",
    startOffsetDays: 0,
    daySpan: 1,
    maxResults: 10,
    emptyText: "今日の予定はありません。",
  },
  tomorrow: {
    label: "明日",
    statusLabel: "明日",
    startOffsetDays: 1,
    daySpan: 1,
    maxResults: 10,
    emptyText: "明日の予定はありません。",
  },
  week: {
    label: "7日間",
    statusLabel: "今後7日間",
    startOffsetDays: 0,
    daySpan: 7,
    maxResults: 30,
    emptyText: "今後7日間の予定はありません。",
  },
};
const transportModeOptions = {
  walk: {
    label: "徒歩",
    statusLabel: "徒歩移動",
    note: "徒歩移動を基準に、雨・風・暑さを重めに見ます。",
  },
  bike: {
    label: "自転車",
    statusLabel: "自転車移動",
    note: "自転車移動を基準に、雨と風を特に厳しめに見ます。",
  },
  car: {
    label: "車",
    statusLabel: "車移動",
    note: "車移動を基準に、視界・雨・横風を中心に見ます。",
  },
};

const defaultLocation = {
  id: "higashihiroshima",
  name: "東広島市",
  admin: "広島県",
  latitude: 34.426,
  longitude: 132.743,
  timezone: "Asia/Tokyo",
  pinned: true,
};

const state = {
  activeLocationId: defaultLocation.id,
  savedLocations: [defaultLocation],
  cache: null,
  newsCache: null,
  eventFeedCache: null,
  calendarClientId: "",
  calendarAccessToken: "",
  calendarTokenExpiresAt: 0,
  calendarEvents: [],
  calendarFetchedAt: "",
  calendarRangeMode: defaultCalendarRangeMode,
  transportMode: defaultTransportMode,
  transportModeTouched: false,
};

const views = {
  dashboard: document.querySelector("#view-dashboard"),
  timeline: document.querySelector("#view-timeline"),
  info: document.querySelector("#view-info"),
  places: document.querySelector("#view-places"),
  settings: document.querySelector("#view-settings"),
};

const viewButtons = document.querySelectorAll(".nav-button");
const todayLabel = document.querySelector("#today-label");
const activeLocationLabel = document.querySelector("#active-location");
const refreshNow = document.querySelector("#refresh-now");
const scoreRing = document.querySelector("#score-ring");
const scoreValue = document.querySelector("#score-value");
const conditionLabel = document.querySelector("#condition-label");
const conditionSummary = document.querySelector("#condition-summary");
const updatedLabel = document.querySelector("#updated-label");
const adviceList = document.querySelector("#advice-list");
const nextPlanHero = document.querySelector("#next-plan-hero");
const transportModeButtons = document.querySelectorAll("[data-transport-mode]");
const transportModeNote = document.querySelector("#transport-mode-note");
const scheduleWeatherPanel = document.querySelector("#schedule-weather-panel");
const temperatureTrendPanel = document.querySelector("#temperature-trend-panel");
const metricGrid = document.querySelector("#metric-grid");
const activityGrid = document.querySelector("#activity-grid");
const hourlyList = document.querySelector("#hourly-list");
const dailyList = document.querySelector("#daily-list");
const calendarConnectionLabel = document.querySelector("#calendar-connection-label");
const calendarStatus = document.querySelector("#calendar-status");
const calendarPreviewList = document.querySelector("#calendar-preview-list");
const connectCalendar = document.querySelector("#connect-calendar");
const disconnectCalendar = document.querySelector("#disconnect-calendar");
const calendarRangeButtons = document.querySelectorAll("[data-calendar-range]");
const refreshNews = document.querySelector("#refresh-news");
const newsUpdated = document.querySelector("#news-updated");
const newsStatus = document.querySelector("#news-status");
const newsList = document.querySelector("#news-list");
const refreshEvents = document.querySelector("#refresh-events");
const autoEventsUpdated = document.querySelector("#auto-events-updated");
const eventsStatus = document.querySelector("#events-status");
const autoEventList = document.querySelector("#auto-event-list");
const searchForm = document.querySelector("#search-form");
const placeQuery = document.querySelector("#place-query");
const placeStatus = document.querySelector("#place-status");
const searchResults = document.querySelector("#search-results");
const savedPlaces = document.querySelector("#saved-places");
const useGps = document.querySelector("#use-gps");
const exportData = document.querySelector("#export-data");
const copyData = document.querySelector("#copy-data");
const importData = document.querySelector("#import-data");
const backupText = document.querySelector("#backup-text");
const backupStatus = document.querySelector("#backup-status");
const checkAppUpdate = document.querySelector("#check-app-update");
const reloadApp = document.querySelector("#reload-app");
const appUpdateStatus = document.querySelector("#app-update-status");
const calendarClientIdInput = document.querySelector("#calendar-client-id");
const saveCalendarClient = document.querySelector("#save-calendar-client");
const clearCalendarClient = document.querySelector("#clear-calendar-client");
const calendarSettingsStatus = document.querySelector("#calendar-settings-status");

let googleIdentityScriptPromise = null;
let calendarTokenClient = null;
let serviceWorkerRegistration = null;
let appUpdateReloading = false;
const serviceWorkerUpdateBindings = new WeakSet();

const calendarPreviewItems = [
  {
    label: "今日",
    title: "本日の予定",
    time: "--:--",
    text: "接続後に今日の予定を開始時刻順で表示",
  },
  {
    label: "Next",
    title: "このあと",
    time: "--:--",
    text: "次の予定、場所、移動前の天気を確認",
  },
  {
    label: "7 days",
    title: "今後7日間",
    time: "準備中",
    text: "外出予定を天気・イベント情報と並べて確認",
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function getActiveLocation() {
  return state.savedLocations.find((location) => location.id === state.activeLocationId) || state.savedLocations[0] || defaultLocation;
}

function getLocationLabel(location) {
  return location.admin ? `${location.name} / ${location.admin}` : location.name;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatDateKey(date, timeZone = defaultLocation.timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDateKey(dateKey, offsetDays) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return date.toISOString().slice(0, 10);
}

function shiftDateTimeKey(dateTimeKey, offsetDays) {
  const [datePart, timePart = "00:00"] = String(dateTimeKey || "").split("T");
  const shiftedDate = shiftDateKey(datePart, offsetDays);
  return shiftedDate ? `${shiftedDate}T${timePart.slice(0, 5)}` : "";
}

function formatTime(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatUpdated(isoString) {
  if (!isoString) return "未取得";
  return `${formatDate(new Date(isoString))} ${formatTime(new Date(isoString))} 更新`;
}

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.savedLocations) && parsed.savedLocations.length) {
      state.savedLocations = dedupeLocations([defaultLocation, ...parsed.savedLocations]);
    }
    if (parsed.activeLocationId) state.activeLocationId = parsed.activeLocationId;
    if (parsed.cache) state.cache = parsed.cache;
    if (parsed.newsCache) state.newsCache = parsed.newsCache;
    if (parsed.eventFeedCache) state.eventFeedCache = normalizeEventFeed(parsed.eventFeedCache);
    if (parsed.calendarClientId) state.calendarClientId = String(parsed.calendarClientId).trim();
    if (isCalendarRangeMode(parsed.calendarRangeMode)) state.calendarRangeMode = parsed.calendarRangeMode;
    if (isTransportMode(parsed.transportMode)) {
      state.transportModeTouched = parsed.transportModeTouched === true;
      state.transportMode = state.transportModeTouched || parsed.transportMode !== "walk" ? parsed.transportMode : defaultTransportMode;
    }
  } catch {
    state.activeLocationId = defaultLocation.id;
    state.savedLocations = [defaultLocation];
    state.cache = null;
    state.newsCache = null;
    state.eventFeedCache = null;
    state.calendarClientId = "";
    state.calendarRangeMode = defaultCalendarRangeMode;
    state.transportMode = defaultTransportMode;
    state.transportModeTouched = false;
    clearCalendarSession();
  }
}

function saveState() {
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      activeLocationId: state.activeLocationId,
      savedLocations: state.savedLocations,
      cache: state.cache,
      newsCache: state.newsCache,
      eventFeedCache: state.eventFeedCache,
      calendarClientId: state.calendarClientId,
      calendarRangeMode: state.calendarRangeMode,
      transportMode: state.transportMode,
      transportModeTouched: state.transportModeTouched,
    }),
  );
}

function dedupeLocations(locations) {
  const map = new Map();
  for (const location of locations) {
    const id = location.id || createLocationId(location);
    map.set(id, { ...location, id });
  }
  return Array.from(map.values());
}

function createLocationId(location) {
  const lat = round(location.latitude, 4);
  const lon = round(location.longitude, 4);
  return `${String(location.name || "place").toLowerCase()}-${lat}-${lon}`.replace(/\s+/g, "-");
}

function normalizeLocation(input) {
  const location = {
    id: input.id,
    name: input.name || input.label || "地点",
    admin: input.admin || [input.admin1, input.admin2, input.country].filter(Boolean).join(" / "),
    latitude: Number(input.latitude),
    longitude: Number(input.longitude),
    timezone: input.timezone || "Asia/Tokyo",
    pinned: Boolean(input.pinned),
  };
  location.id = location.id || createLocationId(location);
  return location;
}

function setActiveLocation(location, shouldSave = true) {
  const normalized = normalizeLocation(location);
  state.activeLocationId = normalized.id;

  if (!state.savedLocations.some((saved) => saved.id === normalized.id)) {
    state.savedLocations.push(normalized);
  }

  state.savedLocations = dedupeLocations(state.savedLocations);
  if (shouldSave) saveState();
  renderPlaceLists();
  fetchWeather();
}

function buildForecastUrl(location) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation",
      "rain",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
      "wind_gusts_10m",
    ].join(","),
    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation_probability",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_gusts_10m",
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "wind_gusts_10m_max",
    ].join(","),
    forecast_days: "3",
    past_days: "1",
    timezone: location.timezone || "Asia/Tokyo",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

function buildAirUrl(location) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: ["pm10", "pm2_5", "uv_index", "us_aqi"].join(","),
    hourly: ["pm10", "pm2_5", "uv_index", "us_aqi"].join(","),
    forecast_days: "2",
    timezone: location.timezone || "Asia/Tokyo",
  });
  return `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`;
}

function buildGeocodingUrl(query) {
  const params = new URLSearchParams({
    name: query,
    count: "8",
    language: "ja",
    format: "json",
    countryCode: "JP",
  });
  return `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`;
}

function buildGdeltUrl() {
  const query = '("Hiroshima" OR "Higashihiroshima" OR "Hiroshima Prefecture")';
  const params = new URLSearchParams({
    query,
    mode: "artlist",
    format: "json",
    maxrecords: "8",
    sort: "datedesc",
    timespan: "1month",
  });
  return `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
}

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchWeather() {
  const location = getActiveLocation();
  renderLoading(location);

  try {
    const [forecast, air] = await Promise.all([
      fetchJson(buildForecastUrl(location)),
      fetchJson(buildAirUrl(location)),
    ]);

    state.cache = {
      version: cacheVersion,
      fetchedAt: new Date().toISOString(),
      location,
      forecast,
      air,
    };
    saveState();
    renderWeather(state.cache, false);
  } catch (error) {
    if (state.cache) {
      renderWeather(state.cache, true, error);
      return;
    }
    renderError(error);
  }
}

function isNewsCacheFresh() {
  if (!state.newsCache?.fetchedAt) return false;
  const ageMs = Date.now() - new Date(state.newsCache.fetchedAt).getTime();
  return ageMs < 30 * 60 * 1000;
}

function maybeFetchNews() {
  if (state.newsCache) renderNews(state.newsCache, true);
  if (!state.newsCache || !isNewsCacheFresh()) fetchNews();
}

async function fetchNews(force = false) {
  if (!force && state.newsCache && isNewsCacheFresh()) {
    renderNews(state.newsCache, true);
    return;
  }

  newsStatus.textContent = "地域ニュースの見出しを取得しています。";

  try {
    const data = await fetchNewsJson(buildGdeltUrl(), 15000);
    const items = normalizeNewsItems(data.articles || data.items || []);
    state.newsCache = {
      version: cacheVersion,
      fetchedAt: new Date().toISOString(),
      items,
    };
    saveState();
    renderNews(state.newsCache, false);
  } catch (error) {
    if (state.newsCache) {
      renderNews(state.newsCache, true, error);
      return;
    }
    newsUpdated.textContent = "未取得";
    newsStatus.textContent = getNewsErrorMessage(error);
    newsList.innerHTML = emptyState("ニュースを取得できませんでした。公式リンクから確認できます。");
  }
}

async function fetchNewsJson(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (text.includes("Please limit requests")) throw new Error("429");
    if (!text.trim().startsWith("{")) throw new Error(text.trim().slice(0, 90));
    return JSON.parse(text);
  } finally {
    window.clearTimeout(timer);
  }
}

function normalizeNewsItems(items) {
  return items
    .map((item) => ({
      title: item.title || item.name || "無題の記事",
      url: item.url_mobile || item.url || item.id || "",
      domain: item.domain || getDomain(item.url || item.id || ""),
      seenDate: item.seendate || item.date_published || item.date_modified || "",
      image: item.socialimage || item.image || "",
      language: item.language || "",
      sourceCountry: item.sourcecountry || "",
    }))
    .filter((item) => item.url)
    .slice(0, 8);
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "news";
  }
}

function formatNewsDate(value) {
  if (!value) return "";
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    const normalized = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`;
    return `${formatDate(new Date(normalized))} ${formatTime(new Date(normalized))}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${formatDate(date)} ${formatTime(date)}`;
}

function renderNews(cache, isCached, error) {
  const items = Array.isArray(cache.items) ? cache.items : [];
  newsUpdated.textContent = isCached ? `保存済み: ${formatUpdated(cache.fetchedAt)}` : formatUpdated(cache.fetchedAt);

  if (error) {
    newsStatus.textContent = `前回取得分を表示しています。${getNewsErrorMessage(error)}`;
  } else {
    newsStatus.textContent = items.length
      ? "見出しとリンクのみを表示します。本文は元サイトで確認します。"
      : "該当するニュースが見つかりませんでした。公式リンクから確認できます。";
  }

  newsList.innerHTML = items.length ? items.map(renderNewsCard).join("") : emptyState("地域ニュースの候補はありません。");
}

function getNewsErrorMessage(error) {
  const message = String(error?.message || "");
  if (message.includes("429")) return "ニュースAPIの取得間隔制限に当たりました。少し待ってから更新してください。";
  if (message.includes("Failed to fetch")) return "ニュースAPIに接続できませんでした。時間を置くか、公式リンクから確認してください。";
  if (message.includes("specified query")) return "ニュースAPIの検索条件が受け付けられませんでした。公式リンクから確認してください。";
  return `ニュースを取得できませんでした。${message}`;
}

function renderNewsCard(item) {
  const date = formatNewsDate(item.seenDate);
  return `
    <article class="news-card">
      <div>
        <p class="news-meta">${escapeHtml([item.domain, date].filter(Boolean).join(" / "))}</p>
        <h3>${escapeHtml(item.title)}</h3>
        <a class="news-open-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">元記事を開く</a>
      </div>
    </article>
  `;
}

function renderCalendarPreview() {
  renderCalendarRangeControls();

  if (hasUsableCalendarToken()) {
    renderCalendarEvents();
    return;
  }

  if (!isValidGoogleClientId(getCalendarClientId())) {
    calendarConnectionLabel.textContent = "Client ID未設定";
    calendarStatus.textContent = "設定タブでOAuth Client IDを確認すると、Google接続を開始できます。";
    connectCalendar.disabled = false;
    connectCalendar.innerHTML = `<svg><use href="#icon-settings"></use></svg>設定へ`;
    disconnectCalendar.disabled = true;
  } else {
    calendarConnectionLabel.textContent = "接続待ち";
    calendarStatus.textContent = "Google接続を押すと、この端末で予定を読み取ります。";
    connectCalendar.disabled = false;
    connectCalendar.innerHTML = `<svg><use href="#icon-calendar"></use></svg>Google接続`;
    disconnectCalendar.disabled = true;
  }

  calendarPreviewList.innerHTML = calendarPreviewItems.map(renderCalendarPreviewCard).join("");
  renderScheduleWeatherPanel();
}

function renderCalendarPreviewCard(item) {
  return `
    <article class="calendar-preview-card">
      <div class="calendar-preview-date">${escapeHtml(item.label)}</div>
      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
      </div>
      <div class="calendar-preview-time">${escapeHtml(item.time)}</div>
    </article>
  `;
}

function renderCalendarSettings() {
  calendarClientIdInput.value = state.calendarClientId || defaultCalendarClientId;
  calendarSettingsStatus.textContent = state.calendarClientId
    ? "上書きClient IDを保存済みです。情報タブからGoogle接続できます。"
    : "内蔵Client IDを使用中です。iPhoneでも追加設定なしでGoogle接続できます。";
}

function saveCalendarClientId() {
  const clientId = calendarClientIdInput.value.trim();

  if (!clientId) {
    state.calendarClientId = "";
    clearCalendarSession();
    calendarTokenClient = null;
    saveState();
    renderCalendarSettings();
    renderCalendarPreview();
    return;
  }

  if (!isValidGoogleClientId(clientId)) {
    calendarSettingsStatus.textContent = "Client IDの形式が違います。apps.googleusercontent.comで終わる値を入れてください。";
    return;
  }

  state.calendarClientId = clientId === defaultCalendarClientId ? "" : clientId;
  clearCalendarSession();
  calendarTokenClient = null;
  saveState();
  renderCalendarSettings();
  renderCalendarPreview();
}

function clearCalendarClientId() {
  state.calendarClientId = "";
  clearCalendarSession();
  calendarTokenClient = null;
  saveState();
  renderCalendarSettings();
  renderCalendarPreview();
}

function getCalendarClientId() {
  const customClientId = String(state.calendarClientId || "").trim();
  return isValidGoogleClientId(customClientId) ? customClientId : defaultCalendarClientId;
}

function isValidGoogleClientId(value) {
  return /^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(String(value || "").trim());
}

function isCalendarRangeMode(value) {
  return Object.prototype.hasOwnProperty.call(calendarRangeOptions, value);
}

function getCalendarRangeOption() {
  return calendarRangeOptions[state.calendarRangeMode] || calendarRangeOptions[defaultCalendarRangeMode];
}

function renderCalendarRangeControls() {
  calendarRangeButtons.forEach((button) => {
    const active = button.dataset.calendarRange === state.calendarRangeMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function isTransportMode(value) {
  return Object.prototype.hasOwnProperty.call(transportModeOptions, value);
}

function getTransportModeOption() {
  return transportModeOptions[state.transportMode] || transportModeOptions[defaultTransportMode];
}

function renderTransportModeControls() {
  const option = getTransportModeOption();
  transportModeButtons.forEach((button) => {
    const active = button.dataset.transportMode === state.transportMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  transportModeNote.textContent = option.note;
}

function handleTransportModeChange(event) {
  const nextMode = event.currentTarget.dataset.transportMode;
  if (!isTransportMode(nextMode) || state.transportMode === nextMode) return;

  state.transportMode = nextMode;
  state.transportModeTouched = true;
  saveState();
  renderTransportModeControls();

  if (state.cache) {
    renderWeather(state.cache, false);
  } else {
    renderScheduleWeatherPanel();
  }
}

function hasUsableCalendarToken() {
  return Boolean(state.calendarAccessToken && Date.now() < state.calendarTokenExpiresAt - 60 * 1000);
}

function clearCalendarSession() {
  state.calendarAccessToken = "";
  state.calendarTokenExpiresAt = 0;
  state.calendarEvents = [];
  state.calendarFetchedAt = "";
}

async function handleCalendarConnect() {
  if (!isValidGoogleClientId(getCalendarClientId())) {
    switchView("settings");
    window.setTimeout(() => calendarClientIdInput.focus(), 150);
    return;
  }

  const range = getCalendarRangeOption();

  try {
    connectCalendar.disabled = true;
    calendarStatus.textContent = hasUsableCalendarToken()
      ? `${range.statusLabel}の予定を更新しています。`
      : "Google認証を開いています。";

    if (!hasUsableCalendarToken()) {
      const token = await requestCalendarAccessToken();
      state.calendarAccessToken = token.access_token;
      state.calendarTokenExpiresAt = Date.now() + Number(token.expires_in || 3600) * 1000;
    }

    await fetchCalendarEvents();
  } catch (error) {
    calendarConnectionLabel.textContent = "接続エラー";
    calendarStatus.textContent = getCalendarErrorMessage(error);
    connectCalendar.innerHTML = `<svg><use href="#icon-calendar"></use></svg>Google接続`;
    disconnectCalendar.disabled = !hasUsableCalendarToken();
    calendarPreviewList.innerHTML = calendarPreviewItems.map(renderCalendarPreviewCard).join("");
  } finally {
    connectCalendar.disabled = false;
  }
}

async function handleCalendarRangeChange(event) {
  const nextRangeMode = event.currentTarget.dataset.calendarRange;
  if (!isCalendarRangeMode(nextRangeMode) || state.calendarRangeMode === nextRangeMode) return;

  state.calendarRangeMode = nextRangeMode;
  saveState();
  renderCalendarRangeControls();

  if (!hasUsableCalendarToken()) {
    renderCalendarPreview();
    return;
  }

  const range = getCalendarRangeOption();
  try {
    connectCalendar.disabled = true;
    calendarStatus.textContent = `${range.statusLabel}の予定を読み込んでいます。`;
    await fetchCalendarEvents();
  } catch (error) {
    calendarConnectionLabel.textContent = "接続エラー";
    calendarStatus.textContent = getCalendarErrorMessage(error);
    connectCalendar.innerHTML = `<svg><use href="#icon-refresh"></use></svg>予定を更新`;
    disconnectCalendar.disabled = !hasUsableCalendarToken();
    calendarPreviewList.innerHTML = emptyState(`${range.statusLabel}の予定を更新できませんでした。`);
  } finally {
    connectCalendar.disabled = false;
  }
}

async function requestCalendarAccessToken() {
  await loadGoogleIdentityScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Servicesを読み込めませんでした。");
  }

  if (!calendarTokenClient) {
    calendarTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: getCalendarClientId(),
      scope: calendarScope,
      callback: () => {},
    });
  }

  return new Promise((resolve, reject) => {
    calendarTokenClient.callback = (response) => {
      if (response?.error) {
        reject(new Error(response.error_description || response.error));
        return;
      }
      resolve(response);
    };

    calendarTokenClient.requestAccessToken({
      prompt: state.calendarAccessToken ? "" : "consent",
    });
  });
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (googleIdentityScriptPromise) return googleIdentityScriptPromise;

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = googleIdentityScriptUrl;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => {
      googleIdentityScriptPromise = null;
      reject(new Error("Google Identity Servicesの読み込みに失敗しました。"));
    };
    document.head.append(script);
  });

  return googleIdentityScriptPromise;
}

async function fetchCalendarEvents() {
  const response = await fetch(buildCalendarEventsUrl(), {
    headers: {
      Authorization: `Bearer ${state.calendarAccessToken}`,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) clearCalendarSession();
    throw new Error(data?.error?.message || `Google Calendar API HTTP ${response.status}`);
  }

  state.calendarEvents = normalizeCalendarEvents(data.items || []);
  state.calendarFetchedAt = new Date().toISOString();
  renderCalendarEvents();
}

function buildCalendarEventsUrl() {
  const range = getCalendarRangeOption();
  const timeMin = new Date();
  timeMin.setHours(0, 0, 0, 0);
  timeMin.setDate(timeMin.getDate() + range.startOffsetDays);

  const timeMax = new Date(timeMin);
  timeMax.setDate(timeMax.getDate() + range.daySpan);

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    timeZone: getActiveLocation().timezone || defaultLocation.timezone,
    singleEvents: "true",
    orderBy: "startTime",
    showDeleted: "false",
    maxResults: String(range.maxResults),
  });

  return `${calendarApiBaseUrl}/calendars/primary/events?${params.toString()}`;
}

function normalizeCalendarEvents(items) {
  return items
    .map((item) => {
      const start = item.start?.dateTime || item.start?.date || "";
      const end = item.end?.dateTime || item.end?.date || "";
      return {
        id: String(item.id || start || item.summary || createEventId()),
        title: item.summary || "予定名なし",
        start,
        end,
        location: item.location || "",
        htmlLink: item.htmlLink || "",
        status: item.status || "",
        allDay: Boolean(item.start?.date),
      };
    })
    .filter((item) => item.start)
    .slice(0, getCalendarRangeOption().maxResults);
}

function renderCalendarEvents() {
  renderCalendarRangeControls();
  const range = getCalendarRangeOption();
  calendarConnectionLabel.textContent = "接続中";
  calendarStatus.textContent = state.calendarFetchedAt
    ? `${range.statusLabel}の予定を表示中: ${formatUpdated(state.calendarFetchedAt)}`
    : "予定を表示中です。";
  connectCalendar.disabled = false;
  connectCalendar.innerHTML = `<svg><use href="#icon-refresh"></use></svg>予定を更新`;
  disconnectCalendar.disabled = false;
  calendarPreviewList.innerHTML = state.calendarEvents.length
    ? state.calendarEvents.map(renderCalendarEventCard).join("")
    : emptyState(range.emptyText);
  renderScheduleWeatherPanel();
}

function renderCalendarEventCard(item) {
  const dateBadge = getCalendarDateBadge(item.start);
  const time = getCalendarTimeLabel(item);
  const text = item.location || (item.allDay ? "終日予定" : "Googleカレンダー");
  const typeLabel = item.location ? "場所あり" : item.allDay ? "終日" : "予定";
  const link = item.htmlLink
    ? `<a class="news-open-link calendar-event-link" href="${escapeHtml(item.htmlLink)}" target="_blank" rel="noopener">カレンダーで開く</a>`
    : "";
  return `
    <article class="calendar-preview-card calendar-event-card">
      <div class="calendar-event-date-badge" aria-label="${escapeHtml(dateBadge.accessibleLabel)}">
        <strong>${escapeHtml(dateBadge.primary)}</strong>
        <span>${escapeHtml(dateBadge.secondary)}</span>
      </div>
      <div class="calendar-event-body">
        <div class="calendar-event-title-row">
          <h3>${escapeHtml(item.title)}</h3>
          <span class="calendar-event-time-pill">${escapeHtml(time)}</span>
        </div>
        <div class="calendar-event-meta-row">
          <span class="calendar-event-type-chip">${escapeHtml(typeLabel)}</span>
          <p>${escapeHtml(text)}</p>
        </div>
        ${link}
      </div>
    </article>
  `;
}

function getCalendarDateBadge(value) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) {
    return {
      primary: "予定",
      secondary: "--/--",
      accessibleLabel: "予定日不明",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "short" }).format(date);
  const monthDay = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(date);
  const primary = diff === 0 ? "今日" : diff === 1 ? "明日" : weekday;

  return {
    primary,
    secondary: monthDay,
    accessibleLabel: `${primary} ${monthDay}`,
  };
}

function getCalendarTimeLabel(item) {
  if (item.allDay) return "終日";
  const start = new Date(item.start);
  if (Number.isNaN(start.getTime())) return "--:--";
  const end = new Date(item.end);
  if (!Number.isNaN(end.getTime()) && end > start) {
    return `${formatTime(start)}-${formatTime(end)}`;
  }
  return formatTime(start);
}

function disconnectGoogleCalendar() {
  const token = state.calendarAccessToken;
  clearCalendarSession();

  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token, () => {});
  }

  renderCalendarPreview();
}

function getCalendarErrorMessage(error) {
  const message = String(error?.message || "");
  if (message.includes("popup") || message.includes("idpiframe")) {
    return "Google認証画面を開けませんでした。Safariのポップアップ設定を確認してください。";
  }
  if (message.includes("origin") || message.includes("Not a valid origin")) {
    return "このURLがGoogle CloudのAuthorized JavaScript originsに登録されていません。";
  }
  if (message.includes("API has not been used") || message.includes("disabled")) {
    return "Google CloudでCalendar APIが有効になっていません。";
  }
  if (message.includes("access_denied")) {
    return "Googleカレンダーへのアクセスが許可されませんでした。";
  }
  return `Googleカレンダーを取得できませんでした。${message}`;
}

function isEventFeedFresh() {
  if (!state.eventFeedCache?.fetchedAt) return false;
  const ageMs = Date.now() - new Date(state.eventFeedCache.fetchedAt).getTime();
  return ageMs < 12 * 60 * 60 * 1000;
}

function maybeFetchEvents() {
  if (state.eventFeedCache) renderAutoEvents(state.eventFeedCache, true);
  if (!state.eventFeedCache || !isEventFeedFresh()) fetchEvents();
}

async function fetchEvents(force = false) {
  if (!force && state.eventFeedCache && isEventFeedFresh()) {
    renderAutoEvents(state.eventFeedCache, true);
    return;
  }

  eventsStatus.textContent = "イベント情報を取得しています。";

  try {
    const response = await fetch(eventFeedUrl, { cache: force ? "reload" : "default" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const feed = normalizeEventFeed(await response.json());
    state.eventFeedCache = feed;
    saveState();
    renderAutoEvents(feed, false);
  } catch (error) {
    if (state.eventFeedCache) {
      renderAutoEvents(state.eventFeedCache, true, error);
      return;
    }
    autoEventsUpdated.textContent = "未取得";
    eventsStatus.textContent = `イベント情報を取得できませんでした。${error.message}`;
    autoEventList.innerHTML = emptyState("イベント自動取得はまだ使えません。公式リンクから確認できます。");
  }
}

function normalizeEventFeed(feed) {
  const items = Array.isArray(feed?.items) ? feed.items : [];
  return {
    version: feed?.version || cacheVersion,
    source: feed?.source || "東広島おでかけ観光サイト「ヒガシル」",
    sourceUrl: feed?.sourceUrl || "https://higashihiroshima-kanko.jp/event/",
    fetchedAt: feed?.fetchedAt || new Date().toISOString(),
    items: items
      .map((item) => ({
        id: String(item.id || item.url || item.title || createEventId()),
        title: String(item.title || "").trim(),
        summary: String(item.summary || "").trim(),
        url: String(item.url || "").trim(),
        dateLabel: String(item.dateLabel || "").trim(),
        startDate: String(item.startDate || "").slice(0, 10),
        endDate: String(item.endDate || "").slice(0, 10),
        area: String(item.area || "").trim(),
        location: String(item.location || "").trim(),
        status: String(item.status || "").trim(),
        tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 3) : [],
        source: String(item.source || feed?.source || "ヒガシル").trim(),
      }))
      .filter((item) => item.title && item.url)
      .slice(0, 12),
  };
}

function renderAutoEvents(feed, isCached, error) {
  const items = Array.isArray(feed.items) ? feed.items : [];
  autoEventsUpdated.textContent = isCached ? `保存済み: ${formatUpdated(feed.fetchedAt)}` : formatUpdated(feed.fetchedAt);

  if (error) {
    eventsStatus.textContent = `前回取得分を表示しています。${error.message}`;
  } else {
    eventsStatus.textContent = items.length
      ? `${feed.source || "ヒガシル"}から取得した候補を表示しています。`
      : "自動取得できるイベント候補はありません。公式リンクから確認できます。";
  }

  autoEventList.innerHTML = items.length
    ? items.map(renderAutoEventCard).join("")
    : emptyState("自動取得イベントはありません。");
}

function renderAutoEventCard(item) {
  const details = [formatAutoEventDate(item), item.area, item.status].filter(Boolean).join(" / ");
  const location = item.location ? `<small>${escapeHtml(item.location)}</small>` : "";
  const summary = item.summary ? `<p>${escapeHtml(item.summary)}</p>` : "";
  const tags = item.tags.length ? `<div class="auto-event-tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : "";
  return `
    <article class="auto-event-card">
      <div>
        <p class="auto-event-meta">${escapeHtml(details || item.source || "イベント")}</p>
        <h3>${escapeHtml(item.title)}</h3>
        ${summary}
        ${location}
        ${tags}
        <a class="news-open-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">詳細を開く</a>
      </div>
    </article>
  `;
}

function formatAutoEventDate(item) {
  if (item.dateLabel) return item.dateLabel;
  if (item.startDate && item.endDate && item.startDate !== item.endDate) {
    return `${formatEventDate(item.startDate)} - ${formatEventDate(item.endDate)}`;
  }
  if (item.startDate) return formatEventDate(item.startDate);
  return "";
}

function createEventId() {
  return window.crypto?.randomUUID?.() || `event-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatEventDate(value) {
  if (!value) return "日付未設定";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : formatDate(date);
}

function renderLoading(location) {
  activeLocationLabel.innerHTML = `<svg><use href="#icon-pin"></use></svg>${escapeHtml(location.name)}`;
  conditionLabel.textContent = "取得中";
  conditionSummary.textContent = "Open-Meteoから天気と空気質を取得しています。";
  updatedLabel.textContent = "通信中";
  renderTemperatureTrendPanel();
}

function renderError(error) {
  scoreRing.style.setProperty("--score", 0);
  scoreValue.textContent = "--";
  conditionLabel.textContent = "取得できませんでした";
  conditionSummary.textContent = error?.message || "通信状態を確認してください。";
  updatedLabel.textContent = "前回データなし";
  renderTemperatureTrendPanel("表示できる前日比較データがありません。");
  metricGrid.innerHTML = emptyState("表示できる天気データがありません。");
  renderScheduleWeatherPanel();
  activityGrid.innerHTML = emptyState("通信できる状態で再取得してください。");
  hourlyList.innerHTML = emptyState("時間帯データは未取得です。");
  dailyList.innerHTML = emptyState("日別データは未取得です。");
}

function renderWeather(cache, isStale, error) {
  const { location, forecast, air, fetchedAt } = cache;
  const current = forecast.current || {};
  const airCurrent = air.current || {};
  const hours = getNextHours(forecast, air);
  const scores = computeScores(current, airCurrent, hours);
  const transport = getTransportModeOption();

  renderTransportModeControls();
  activeLocationLabel.innerHTML = `<svg><use href="#icon-pin"></use></svg>${escapeHtml(location.name)}`;
  scoreRing.style.setProperty("--score", scores.outdoor);
  scoreRing.style.setProperty("--score-color", getScoreColor(scores.outdoor));
  scoreValue.textContent = String(scores.outdoor);
  conditionLabel.textContent = getTransportScoreLabel(scores.outdoor, state.transportMode);
  conditionSummary.textContent = `${getWeatherName(current.weather_code)} / ${transport.statusLabel}基準`;
  updatedLabel.textContent = isStale
    ? `前回データ: ${formatUpdated(fetchedAt)}`
    : formatUpdated(fetchedAt);

  if (isStale && error) {
    adviceList.innerHTML = renderAdvice([`通信できないため前回取得データを表示しています。`, ...scores.advice]);
  } else {
    adviceList.innerHTML = renderAdvice(scores.advice);
  }

  metricGrid.innerHTML = renderMetrics(current, airCurrent, hours);
  renderScheduleWeatherPanel();
  renderTemperatureTrendPanel(forecast, location);
  activityGrid.innerHTML = renderActivities(scores.activities);
  hourlyList.innerHTML = renderHours(hours);
  dailyList.innerHTML = renderDaily(forecast, location);
  renderPlaceLists();
}

function renderTemperatureTrendPanel(forecast, location = getActiveLocation()) {
  if (!temperatureTrendPanel) return;

  if (typeof forecast === "string") {
    temperatureTrendPanel.innerHTML = renderTemperatureTrendEmpty(forecast);
    return;
  }

  if (!forecast) {
    temperatureTrendPanel.innerHTML = renderTemperatureTrendEmpty("天気データ取得後に、今の体感気温と昨日との差を表示します。");
    return;
  }

  const trend = getTemperatureTrend(forecast, location);
  if (!trend) {
    temperatureTrendPanel.innerHTML = renderTemperatureTrendEmpty("前日比較データがありません。再取得すると表示できる場合があります。");
    return;
  }

  temperatureTrendPanel.classList.remove("warmer", "cooler", "steady");
  temperatureTrendPanel.classList.add(trend.tone);
  temperatureTrendPanel.innerHTML = `
    <div class="temperature-trend-header">
      <div>
        <span class="section-kicker">Change</span>
        <h2>昨日からの気温変化</h2>
      </div>
      <span>${escapeHtml(trend.badge)}</span>
    </div>
    <strong class="temperature-trend-title">${escapeHtml(trend.title)}</strong>
    <p class="temperature-trend-summary">${escapeHtml(trend.summary)}</p>
    <div class="temperature-trend-details">
      ${trend.details.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function renderTemperatureTrendEmpty(text) {
  temperatureTrendPanel?.classList.remove("warmer", "cooler", "steady");
  return `
    <div>
      <span class="section-kicker">Change</span>
      <h2>昨日からの気温変化</h2>
    </div>
    <p class="temperature-trend-empty">${escapeHtml(text)}</p>
  `;
}

function renderScheduleWeatherPanel() {
  if (!scheduleWeatherPanel) return;
  renderNextPlanHero();

  if (!state.cache) {
    scheduleWeatherPanel.innerHTML = renderScheduleWeatherEmpty("天気データを取得すると、次の予定と合わせて判断できます。");
    return;
  }

  if (!hasUsableCalendarToken()) {
    scheduleWeatherPanel.innerHTML = renderScheduleWeatherEmpty("Googleカレンダーを接続すると、次の予定の時間帯に合わせた天気判断を表示します。");
    return;
  }

  const event = findNextCalendarEvent();
  if (!event) {
    const range = getCalendarRangeOption();
    scheduleWeatherPanel.innerHTML = renderScheduleWeatherEmpty(`${range.statusLabel}の表示範囲に、これからの予定はありません。`);
    return;
  }

  const weatherMatch = findWeatherForCalendarEvent(state.cache, event);
  if (!weatherMatch) {
    scheduleWeatherPanel.innerHTML = renderScheduleWeatherNoForecast(event);
    return;
  }

  scheduleWeatherPanel.innerHTML = renderScheduleWeatherDecision(event, weatherMatch);
}

function renderNextPlanHero() {
  if (!nextPlanHero) return;

  if (!hasUsableCalendarToken()) {
    nextPlanHero.innerHTML = `
      <div>
        <span class="section-kicker">Today</span>
        <h2>今日の次の予定</h2>
      </div>
      <p class="next-plan-empty">Googleカレンダー接続後に、今日の次の予定を大きく表示します。</p>
    `;
    return;
  }

  const event = findNextTodayCalendarEvent();
  if (!event) {
    nextPlanHero.innerHTML = `
      <div>
        <span class="section-kicker">Today</span>
        <h2>今日の次の予定</h2>
      </div>
      <p class="next-plan-empty">今日のこれからの予定はありません。</p>
    `;
    return;
  }

  const weatherMatch = state.cache ? findWeatherForCalendarEvent(state.cache, event) : null;
  nextPlanHero.innerHTML = renderNextPlanHeroCard(event, weatherMatch);
}

function findNextTodayCalendarEvent() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  return state.calendarEvents
    .map((event) => ({
      event,
      start: getCalendarEventStart(event),
      end: getCalendarEventEnd(event),
    }))
    .filter((item) => {
      if (!item.start) return false;
      const end = item.end || item.start;
      const overlapsToday = item.start < todayEnd && end >= todayStart;
      const stillRelevant = item.start >= now || end > now;
      return overlapsToday && stillRelevant;
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0]?.event || null;
}

function renderNextPlanHeroCard(event, weatherMatch) {
  const transport = getTransportModeOption();
  const eventTime = formatCalendarEventTimeForWeather(event);
  const location = event.location || "場所情報なし";

  if (!weatherMatch) {
    return `
      <div class="next-plan-top">
        <div>
          <span class="section-kicker">Today</span>
          <h2>今日の次の予定</h2>
        </div>
      </div>
      <div class="next-plan-main">
        <p class="next-plan-title">${escapeHtml(event.title)}</p>
        <p class="next-plan-meta">${escapeHtml(eventTime)} / ${escapeHtml(location)}</p>
        <p class="next-plan-summary">天気データを取得すると、${escapeHtml(transport.statusLabel)}基準の判断をここに表示します。</p>
      </div>
    `;
  }

  const score = computeTransportHourScore(weatherMatch.hour, state.transportMode);
  const tone = score >= 72 ? "good" : score >= 48 ? "warn" : "bad";
  const rain = round(weatherMatch.hour.rainProbability);
  const temp = round(weatherMatch.hour.temperature, 1);
  const wind = round(weatherMatch.hour.wind, 1);
  const title = getTransportDecisionTitle(score, state.transportMode);

  return `
    <div class="next-plan-top">
      <div>
        <span class="section-kicker">Today</span>
        <h2>今日の次の予定</h2>
      </div>
      <strong class="next-plan-score ${tone}">${score}</strong>
    </div>
    <div class="next-plan-main">
      <p class="next-plan-title">${escapeHtml(event.title)}</p>
      <p class="next-plan-meta">${escapeHtml(eventTime)} / ${escapeHtml(location)}</p>
      <div class="next-plan-summary ${tone}">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(transport.statusLabel)}基準 / 雨 ${rain ?? "--"}% / 気温 ${temp ?? "--"}度 / 風 ${wind ?? "--"}km/h</span>
      </div>
    </div>
  `;
}

function renderScheduleWeatherEmpty(text) {
  return `
    <div class="schedule-weather-header">
      <div>
        <span class="section-kicker">Plan weather</span>
        <h2>次の予定 × 天気</h2>
      </div>
    </div>
    <div class="schedule-weather-empty">${escapeHtml(text)}</div>
  `;
}

function findNextCalendarEvent() {
  const now = new Date();
  return state.calendarEvents
    .map((event) => ({
      event,
      start: getCalendarEventStart(event),
      end: getCalendarEventEnd(event),
    }))
    .filter((item) => item.start && (item.start >= now || (item.end && item.end > now)))
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0]?.event || null;
}

function getCalendarEventStart(event) {
  if (!event?.start) return null;
  const date = new Date(event.start.length === 10 ? `${event.start}T00:00:00` : event.start);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCalendarEventEnd(event) {
  if (!event?.end) return null;
  const date = new Date(event.end.length === 10 ? `${event.end}T00:00:00` : event.end);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCalendarEventWeatherTarget(event) {
  const start = getCalendarEventStart(event);
  if (!start) return null;

  if (!event.allDay) {
    const end = getCalendarEventEnd(event);
    const now = new Date();
    return start < now && end && end > now ? now : start;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(start);
  target.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime()) return new Date();
  target.setHours(12, 0, 0, 0);
  return target;
}

function findWeatherForCalendarEvent(cache, event) {
  const target = getCalendarEventWeatherTarget(event);
  if (!target) return null;

  const hours = getForecastHours(cache.forecast, cache.air);
  let best = null;
  for (const hour of hours) {
    const date = new Date(hour.time);
    if (Number.isNaN(date.getTime())) continue;
    const diffMs = Math.abs(date.getTime() - target.getTime());
    if (!best || diffMs < best.diffMs) {
      best = { hour, date, diffMs };
    }
  }

  if (!best || best.diffMs > 90 * 60 * 1000) return null;
  return { ...best, target };
}

function getForecastHours(forecast, air) {
  const hourly = forecast?.hourly || {};
  const airHourly = air?.hourly || {};
  const times = hourly.time || [];
  return times.map((time, index) => {
    const airIndex = (airHourly.time || []).indexOf(time);
    return {
      time,
      temperature: valueAt(hourly.temperature_2m, index),
      apparent: valueAt(hourly.apparent_temperature, index),
      rainProbability: valueAt(hourly.precipitation_probability, index),
      precipitation: valueAt(hourly.precipitation, index),
      weatherCode: valueAt(hourly.weather_code, index),
      wind: valueAt(hourly.wind_speed_10m, index),
      gust: valueAt(hourly.wind_gusts_10m, index),
      pm25: valueAt(airHourly.pm2_5, airIndex),
      uv: valueAt(airHourly.uv_index, airIndex),
      aqi: valueAt(airHourly.us_aqi, airIndex),
    };
  });
}

function renderScheduleWeatherNoForecast(event) {
  return `
    <div class="schedule-weather-header">
      <div>
        <span class="section-kicker">Plan weather</span>
        <h2>次の予定 × 天気</h2>
      </div>
    </div>
    <div class="schedule-weather-empty">
      ${escapeHtml(event.title)} は予報取得範囲の外です。近い予定になると天気判断を表示できます。
    </div>
  `;
}

function renderScheduleWeatherDecision(event, weatherMatch) {
  const { hour } = weatherMatch;
  const transport = getTransportModeOption();
  const score = computeTransportHourScore(hour, state.transportMode);
  const tone = score >= 72 ? "good" : score >= 48 ? "warn" : "bad";
  const title = getTransportDecisionTitle(score, state.transportMode);
  const eventTime = formatCalendarEventTimeForWeather(event);
  const location = event.location || "場所情報なし";
  const rain = round(hour.rainProbability);
  const temp = round(hour.temperature, 1);
  const wind = round(hour.wind, 1);
  const weather = getWeatherName(hour.weatherCode);
  const advice = buildScheduleWeatherAdvice(hour, score, state.transportMode);

  return `
    <div class="schedule-weather-header">
      <div>
        <span class="section-kicker">Plan weather</span>
        <h2>次の予定 × 天気</h2>
      </div>
      <strong class="schedule-weather-score ${tone}">${score}</strong>
    </div>
    <div class="schedule-weather-main">
      <p class="schedule-weather-title">${escapeHtml(event.title)}</p>
      <p class="schedule-weather-time">${escapeHtml(eventTime)} / ${escapeHtml(location)}</p>
      <div class="schedule-weather-summary">
        <span class="${tone}">${escapeHtml(title)}</span>
        <small>${escapeHtml(transport.statusLabel)}基準 / ${escapeHtml(weather)} / 雨 ${rain ?? "--"}% / 気温 ${temp ?? "--"}度 / 風 ${wind ?? "--"}km/h</small>
      </div>
      <div class="schedule-weather-advice">
        ${advice.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </div>
  `;
}

function formatCalendarEventTimeForWeather(event) {
  const start = getCalendarEventStart(event);
  if (!start) return "予定時刻不明";
  const dateLabel = getCalendarDateBadge(event.start).accessibleLabel;
  if (event.allDay) return `${dateLabel} 終日`;
  return `${dateLabel} ${getCalendarTimeLabel(event)}`;
}

function buildScheduleWeatherAdvice(hour, score, mode = state.transportMode) {
  const advice = [];
  const rain = Number(hour.rainProbability || 0);
  const wind = Number(hour.wind || 0);
  const gust = Number(hour.gust || wind);
  const temp = Number(hour.apparent ?? hour.temperature ?? 20);
  const uv = Number(hour.uv || 0);

  if (mode === "car") {
    if (rain >= 60 || Number(hour.precipitation || 0) >= 1) advice.push("視界と路面に注意");
    else if (rain >= 35) advice.push("乗降時の雨具を確認");
    else advice.push("雨の影響は小さめ");

    if (gust >= 40 || wind >= 28) advice.push("横風とドア開閉に注意");
    else advice.push(score >= 72 ? "通常運転で動きやすい" : "時間に余裕を足す");
    return advice.slice(0, 2);
  }

  if (mode === "bike") {
    if (rain >= 45 || Number(hour.precipitation || 0) >= 0.5) advice.push("雨具か徒歩・車も候補");
    else if (rain >= 25) advice.push("路面変化に注意");
    else advice.push("雨の心配は小さめ");

    if (gust >= 30 || wind >= 20) advice.push("風でふらつきやすい");
    else if (temp >= 30) advice.push("暑さと水分を優先");
    else advice.push(score >= 72 ? "自転車でも動きやすい" : "短距離中心が無難");
    return advice.slice(0, 2);
  }

  if (rain >= 60 || Number(hour.precipitation || 0) >= 1) advice.push("傘か雨具を先に用意");
  else if (rain >= 35) advice.push("折りたたみ傘があると安心");
  else advice.push("雨の心配は小さめ");

  if (gust >= 35 || wind >= 24) advice.push("風が強め。自転車と傘に注意");
  else if (temp >= 30) advice.push("暑さ対策と水分を優先");
  else if (temp <= 5) advice.push("防寒を優先");
  else if (uv >= 7) advice.push("日差し対策を追加");
  else advice.push(score >= 72 ? "通常装備で動きやすい" : "用事は短めが無難");

  return advice.slice(0, 2);
}

function getNextHours(forecast, air) {
  const hourly = forecast.hourly || {};
  const airHourly = air.hourly || {};
  const times = hourly.time || [];
  const now = new Date();
  let startIndex = times.findIndex((time) => new Date(time) >= now);
  if (startIndex < 0) startIndex = 0;

  return times.slice(startIndex, startIndex + 12).map((time, offset) => {
    const index = startIndex + offset;
    const airIndex = (airHourly.time || []).indexOf(time);
    return {
      time,
      temperature: valueAt(hourly.temperature_2m, index),
      apparent: valueAt(hourly.apparent_temperature, index),
      rainProbability: valueAt(hourly.precipitation_probability, index),
      precipitation: valueAt(hourly.precipitation, index),
      weatherCode: valueAt(hourly.weather_code, index),
      wind: valueAt(hourly.wind_speed_10m, index),
      gust: valueAt(hourly.wind_gusts_10m, index),
      pm25: valueAt(airHourly.pm2_5, airIndex),
      uv: valueAt(airHourly.uv_index, airIndex),
      aqi: valueAt(airHourly.us_aqi, airIndex),
    };
  });
}

function valueAt(values, index) {
  if (!Array.isArray(values) || index < 0) return null;
  return values[index] ?? null;
}

function getTemperatureTrend(forecast, location = getActiveLocation()) {
  const daily = forecast?.daily || {};
  const apparentTrend = getApparentTemperatureTrend(forecast);
  const hasDaily = Array.isArray(daily.time);

  const todayKey = formatDateKey(new Date(), location.timezone || defaultLocation.timezone);
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const todayIndex = hasDaily ? daily.time.indexOf(todayKey) : -1;
  const yesterdayIndex = hasDaily ? daily.time.indexOf(yesterdayKey) : -1;

  const todayMax = round(valueAt(daily.temperature_2m_max, todayIndex), 1);
  const yesterdayMax = round(valueAt(daily.temperature_2m_max, yesterdayIndex), 1);
  const todayMin = round(valueAt(daily.temperature_2m_min, todayIndex), 1);
  const yesterdayMin = round(valueAt(daily.temperature_2m_min, yesterdayIndex), 1);
  if (!apparentTrend && (todayMax === null || yesterdayMax === null)) return null;

  const maxDiff = todayMax === null || yesterdayMax === null ? null : round(todayMax - yesterdayMax, 1);
  const minDiff = todayMin === null || yesterdayMin === null ? null : round(todayMin - yesterdayMin, 1);
  if (apparentTrend) {
    const details = [
      apparentTrend.detail,
      apparentTrend.yesterdayDetail,
      maxDiff === null ? null : `最高 ${formatSignedTemperatureDiff(maxDiff)}`,
      minDiff === null ? null : `最低 ${formatSignedTemperatureDiff(minDiff)}`,
    ].filter(Boolean);

    return {
      tone: apparentTrend.tone,
      title: `現在の体感 ${formatTemperature(apparentTrend.current)}度`,
      summary: apparentTrend.summary,
      details,
      badge: apparentTrend.badge,
    };
  }

  const absMaxDiff = Math.abs(maxDiff);
  const tone = absMaxDiff < 0.5 ? "steady" : maxDiff > 0 ? "warmer" : "cooler";
  const title = buildTemperatureTrendTitle(maxDiff);
  const summary = `最高気温で比較: ${formatTemperature(yesterdayMax)}度 → ${formatTemperature(todayMax)}度`;
  const badge = tone === "warmer" ? "暑くなる" : tone === "cooler" ? "涼しくなる" : "ほぼ同じ";

  return {
    tone,
    title,
    summary,
    details: [
      `最高 ${formatSignedTemperatureDiff(maxDiff)}`,
      minDiff === null ? "最低 データなし" : `最低 ${formatSignedTemperatureDiff(minDiff)}`,
    ],
    badge,
  };
}

function getApparentTemperatureTrend(forecast) {
  const currentApparent = round(forecast?.current?.apparent_temperature, 1);
  if (currentApparent === null) return null;

  const hourly = forecast?.hourly || {};
  const times = hourly.time || [];
  const yesterdayTime = shiftDateTimeKey(forecast?.current?.time, -1);
  const yesterdayIndex = times.indexOf(yesterdayTime);
  const yesterdayApparent = round(valueAt(hourly.apparent_temperature, yesterdayIndex), 1);
  if (yesterdayApparent === null) {
    return {
      current: currentApparent,
      tone: "steady",
      summary: "昨日の同じ時刻の体感データは取得できませんでした。",
      detail: "体感 現在値のみ",
      yesterdayDetail: null,
      badge: "体感",
    };
  }

  const diff = round(currentApparent - yesterdayApparent, 1);
  const tone = Math.abs(diff) < 0.5 ? "steady" : diff > 0 ? "warmer" : "cooler";
  const badge = tone === "warmer" ? "体感高め" : tone === "cooler" ? "体感低め" : "体感ほぼ同じ";
  return {
    current: currentApparent,
    yesterday: yesterdayApparent,
    diff,
    tone,
    summary: buildApparentTemperatureTrendSummary(diff),
    detail: `体感 ${formatSignedTemperatureDiff(diff)}`,
    yesterdayDetail: `昨日同時刻 ${formatTemperature(yesterdayApparent)}度`,
    badge,
  };
}

function buildApparentTemperatureTrendSummary(diff) {
  const amount = formatTemperature(Math.abs(diff));
  if (Math.abs(diff) < 0.5) return "昨日の同じ時刻とほぼ同じ体感です。";
  if (diff > 0) return `昨日の同じ時刻より${amount}度高く感じます。`;
  return `昨日の同じ時刻より${amount}度低く感じます。`;
}

function buildTemperatureTrendTitle(diff) {
  const amount = formatTemperature(Math.abs(diff));
  if (Math.abs(diff) < 0.5) return "昨日とほぼ同じ気温です";
  if (diff > 0) return `昨日より${amount}度暑くなります`;
  return `昨日より${amount}度涼しくなります`;
}

function formatSignedTemperatureDiff(diff) {
  if (Math.abs(diff) < 0.5) return "ほぼ同じ";
  return `${diff > 0 ? "+" : "-"}${formatTemperature(Math.abs(diff))}度`;
}

function formatTemperature(value) {
  const rounded = round(value, 1);
  if (rounded === null) return "--";
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function computeTransportCompositeScore(values, mode = state.transportMode) {
  const transportMode = isTransportMode(mode) ? mode : defaultTransportMode;
  const tempScore = Number(values.tempScore ?? 70);
  const rainScore = Number(values.rainScore ?? 70);
  const windScore = Number(values.windScore ?? 70);
  const airScore = Number(values.airScore ?? 70);
  const uvScore = Number(values.uvScore ?? 70);
  const rainProbability = Number(values.nextRainProbability ?? values.rainProbability ?? 0);
  const precipitation = Number(values.nextPrecipitation ?? values.precipitation ?? 0);
  const gust = Number(values.gust || values.wind || 0);

  if (transportMode === "car") {
    const visibilityPenalty = Math.max(0, rainProbability - 55) * 0.18 + Math.max(0, precipitation - 2) * 4;
    const gustPenalty = Math.max(0, gust - 40) * 1.8;
    return Math.round(clamp(rainScore * 0.46 + windScore * 0.32 + tempScore * 0.08 + airScore * 0.08 + uvScore * 0.02 + 8 - visibilityPenalty - gustPenalty, 0, 100));
  }

  if (transportMode === "bike") {
    const wetRoadPenalty = Math.max(0, rainProbability - 35) * 0.28 + Math.max(0, precipitation - 0.5) * 7;
    const gustPenalty = Math.max(0, gust - 28) * 2.4;
    return Math.round(clamp(tempScore * 0.18 + rainScore * 0.34 + windScore * 0.3 + airScore * 0.1 + uvScore * 0.08 - wetRoadPenalty - gustPenalty, 0, 100));
  }

  return Math.round(clamp(tempScore * 0.26 + rainScore * 0.3 + windScore * 0.18 + airScore * 0.16 + uvScore * 0.1, 0, 100));
}

function computeScores(current, airCurrent, hours) {
  const nextRainProbability = Math.max(...hours.map((hour) => Number(hour.rainProbability || 0)), 0);
  const nextPrecipitation = hours.reduce((total, hour) => total + Number(hour.precipitation || 0), 0);
  const apparent = Number(current.apparent_temperature ?? current.temperature_2m ?? 20);
  const wind = Number(current.wind_speed_10m || 0);
  const gust = Number(current.wind_gusts_10m || wind);
  const pm25 = Number(airCurrent.pm2_5 || 0);
  const uv = Number(airCurrent.uv_index || 0);
  const cloud = Number(current.cloud_cover || 0);

  const tempScore = 100 - Math.min(Math.abs(apparent - 21) * 5.5, 70);
  const rainScore = clamp(100 - nextRainProbability * 0.8 - nextPrecipitation * 9, 0, 100);
  const windScore = clamp(100 - Math.max(0, wind - 12) * 3.2 - Math.max(0, gust - 28) * 2, 0, 100);
  const airScore = clamp(100 - Math.max(0, pm25 - 12) * 2.8, 0, 100);
  const uvScore = clamp(100 - Math.max(0, uv - 5) * 12, 0, 100);
  const components = {
    tempScore,
    rainScore,
    windScore,
    airScore,
    uvScore,
    nextRainProbability,
    nextPrecipitation,
    apparent,
    wind,
    gust,
    pm25,
    uv,
  };
  const outdoor = computeTransportCompositeScore(components, state.transportMode);

  const walk = computeTransportCompositeScore(components, "walk");
  const laundry = Math.round(clamp(rainScore * 0.45 + (100 - cloud) * 0.25 + windScore * 0.15 + tempScore * 0.15, 0, 100));
  const shopping = Math.round(clamp(outdoor * 0.75 + rainScore * 0.15 + windScore * 0.1, 0, 100));
  const drive = computeTransportCompositeScore(components, "car");

  const advice = buildAdvice({ ...components, outdoor, transportMode: state.transportMode });

  return {
    outdoor,
    advice,
    activities: [
      { key: "walk", title: "散歩", score: walk, text: scoreText(walk, "外を歩きやすい", "短時間なら可", "屋内寄り") },
      { key: "laundry", title: "洗濯", score: laundry, text: scoreText(laundry, "外干し向き", "様子見", "部屋干し寄り") },
      { key: "shopping", title: "買い物", score: shopping, text: scoreText(shopping, "出やすい", "用事を絞る", "後回し候補") },
      { key: "drive", title: "車移動", score: drive, text: scoreText(drive, "運転しやすい", "雨風に注意", "慎重に判断") },
    ],
  };
}

function buildAdvice(values) {
  const advice = [];
  const mode = isTransportMode(values.transportMode) ? values.transportMode : defaultTransportMode;
  if (values.nextRainProbability >= 60 || values.nextPrecipitation >= 2) {
    advice.push(mode === "car" ? "雨が強い時間帯があります。運転は視界と路面を優先してください。" : "雨の可能性が高めです。外出するなら傘と短い用事中心が無難です。");
  } else if (values.nextRainProbability <= 25) {
    advice.push(mode === "bike" ? "雨の心配は小さめです。風が弱ければ自転車も選びやすい条件です。" : "雨の心配は小さめです。短い外出や散歩を入れやすい条件です。");
  }

  if (values.gust >= 35 || values.wind >= 24) {
    advice.push(mode === "car" ? "風が強めです。橋や開けた道では横風に注意してください。" : "風が強めです。自転車、洗濯物、傘の扱いに注意してください。");
  } else if (mode === "bike" && (values.gust >= 28 || values.wind >= 18)) {
    advice.push("自転車では風を受けやすい条件です。短距離中心が無難です。");
  }

  if (values.pm25 >= 35) {
    advice.push("PM2.5が高めです。長時間の屋外活動は控えめに見るのが安全です。");
  }

  if (values.uv >= 7) {
    advice.push("UVが強めです。昼の外出は日差し対策を前提にしてください。");
  }

  if (values.apparent <= 5) {
    advice.push("体感温度が低いです。屋外では防寒を優先してください。");
  } else if (values.apparent >= 30) {
    advice.push(mode === "car" ? "車内も暑くなりやすいです。乗る前の換気と水分を意識してください。" : "体感温度が高いです。徒歩移動は短めにして水分を用意してください。");
  }

  if (!advice.length) {
    const transport = getTransportModeOption();
    advice.push(values.outdoor >= 70 ? `${transport.statusLabel}でも大きな注意条件は少なめです。` : `${transport.statusLabel}では条件を見て、近場の用事から選ぶのが現実的です。`);
  }

  return advice.slice(0, 3);
}

function scoreText(score, good, warn, bad) {
  if (score >= 72) return good;
  if (score >= 48) return warn;
  return bad;
}

function getTransportDecisionTitle(score, mode = state.transportMode) {
  if (mode === "car") return scoreText(score, "車で動きやすい", "運転は準備して出る", "時間変更も候補");
  if (mode === "bike") return scoreText(score, "自転車向き", "短距離なら自転車可", "徒歩か車も候補");
  return scoreText(score, "予定どおり歩きやすい", "準備して歩く", "時間変更も候補");
}

function getTransportScoreLabel(score, mode = state.transportMode) {
  if (mode === "car") {
    if (score >= 82) return "車で動きやすい";
    if (score >= 66) return "運転しやすい";
    if (score >= 45) return "運転は注意";
    return "車でも慎重に";
  }

  if (mode === "bike") {
    if (score >= 82) return "自転車向き";
    if (score >= 66) return "短距離なら自転車";
    if (score >= 45) return "風雨を見て判断";
    return "自転車は避けたい";
  }

  if (score >= 82) return "歩きやすい";
  if (score >= 66) return "短時間なら歩きやすい";
  if (score >= 45) return "条件を見て徒歩";
  return "屋内中心が無難";
}

function getScoreLabel(score) {
  if (score >= 82) return "外に出やすい";
  if (score >= 66) return "短時間なら動きやすい";
  if (score >= 45) return "条件を見て外出";
  return "屋内中心が無難";
}

function getScoreColor(score) {
  if (score >= 72) return "var(--green)";
  if (score >= 48) return "var(--amber)";
  return "var(--coral)";
}

function getWeatherName(code) {
  const value = Number(code);
  if ([0].includes(value)) return "快晴";
  if ([1, 2].includes(value)) return "晴れまたは薄い雲";
  if ([3].includes(value)) return "曇り";
  if ([45, 48].includes(value)) return "霧";
  if ([51, 53, 55, 56, 57].includes(value)) return "霧雨";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return "雨";
  if ([71, 73, 75, 77, 85, 86].includes(value)) return "雪";
  if ([95, 96, 99].includes(value)) return "雷雨";
  return "天気コード未分類";
}

function renderAdvice(items) {
  return items.map((item) => `<div class="advice-item">${escapeHtml(item)}</div>`).join("");
}

function renderMetrics(current, airCurrent, hours) {
  const nextRainProbability = Math.max(...hours.map((hour) => Number(hour.rainProbability || 0)), 0);
  const temp = round(current.temperature_2m, 1);
  const apparent = round(current.apparent_temperature, 1);
  const wind = round(current.wind_speed_10m, 1);
  const gust = round(current.wind_gusts_10m, 1);
  const pm25 = round(airCurrent.pm2_5, 1);
  const uv = round(airCurrent.uv_index, 1);

  const cards = [
    ["気温", temp === null ? "--" : `${temp}度`, apparent === null ? "体感温度なし" : `体感 ${apparent}度`],
    ["雨", `${round(nextRainProbability)}%`, "このあと12時間の最大確率"],
    ["風", wind === null ? "--" : `${wind}km/h`, gust === null ? "突風データなし" : `突風 ${gust}km/h`],
    ["空気", pm25 === null ? "--" : `PM2.5 ${pm25}`, airCurrent.us_aqi === undefined ? `UV ${uv ?? "--"}` : `AQI ${round(airCurrent.us_aqi)} / UV ${uv ?? "--"}`],
  ];

  return cards
    .map(
      ([label, value, help]) => `
        <div class="metric-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <small>${escapeHtml(help)}</small>
        </div>
      `,
    )
    .join("");
}

function renderActivities(activities) {
  return activities
    .map((activity) => {
      const tone = activity.score >= 72 ? "good" : activity.score >= 48 ? "warn" : "bad";
      return `
        <article class="activity-card ${tone}">
          <div class="activity-score">${activity.score}</div>
          <div>
            <h3>${escapeHtml(activity.title)}</h3>
            <p>${escapeHtml(activity.text)}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderHours(hours) {
  if (!hours.length) return emptyState("時間帯データがありません。");

  return hours
    .map((hour) => {
      const score = computeHourScore(hour);
      return `
        <article class="hour-card">
          <div class="hour-time">${formatTime(new Date(hour.time))}</div>
          <div class="hour-main">
            <strong>${escapeHtml(getWeatherName(hour.weatherCode))}</strong>
            <span>雨 ${round(hour.rainProbability) ?? "--"}% / ${round(hour.temperature, 1) ?? "--"}度 / 風 ${round(hour.wind, 1) ?? "--"}km/h</span>
            <div class="bar-track"><div class="bar-value" style="width: ${score}%; background: ${getScoreColor(score)}"></div></div>
          </div>
          <div class="hour-score">${score}</div>
        </article>
      `;
    })
    .join("");
}

function computeTransportHourScore(hour, mode = state.transportMode) {
  const temp = Number(hour.apparent ?? hour.temperature ?? 20);
  const tempScore = 100 - Math.min(Math.abs(temp - 21) * 5.5, 70);
  const rainScore = clamp(100 - Number(hour.rainProbability || 0) * 0.85 - Number(hour.precipitation || 0) * 10, 0, 100);
  const wind = Number(hour.wind || 0);
  const gust = Number(hour.gust || wind);
  const windScore = clamp(100 - Math.max(0, wind - 12) * 3 - Math.max(0, gust - 28) * 1.7, 0, 100);
  const airScore = clamp(100 - Math.max(0, Number(hour.pm25 || 0) - 12) * 2.8, 0, 100);
  const uvScore = clamp(100 - Math.max(0, Number(hour.uv || 0) - 5) * 12, 0, 100);
  return computeTransportCompositeScore({
    tempScore,
    rainScore,
    windScore,
    airScore,
    uvScore,
    rainProbability: Number(hour.rainProbability || 0),
    precipitation: Number(hour.precipitation || 0),
    wind,
    gust,
  }, mode);
}

function computeHourScore(hour) {
  return computeTransportHourScore(hour, state.transportMode);
}

function renderDaily(forecast, location = getActiveLocation()) {
  const daily = forecast.daily || {};
  if (!Array.isArray(daily.time)) return emptyState("日別データがありません。");
  const todayKey = formatDateKey(new Date(), location.timezone || defaultLocation.timezone);
  const visibleDays = daily.time
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => time >= todayKey);
  const days = visibleDays.length ? visibleDays : daily.time.map((time, index) => ({ time, index }));

  return days
    .map(({ time, index }) => {
      const max = round(valueAt(daily.temperature_2m_max, index), 1);
      const min = round(valueAt(daily.temperature_2m_min, index), 1);
      const rain = round(valueAt(daily.precipitation_sum, index), 1);
      const probability = round(valueAt(daily.precipitation_probability_max, index));
      const wind = round(valueAt(daily.wind_speed_10m_max, index), 1);
      return `
        <article class="day-card">
          <div class="day-date">${formatDate(new Date(time))}</div>
          <div class="day-main">
            <strong>${escapeHtml(getWeatherName(valueAt(daily.weather_code, index)))}</strong>
            <span>気温 ${min ?? "--"}から${max ?? "--"}度 / 雨 ${probability ?? "--"}% / 降水 ${rain ?? "--"}mm / 風 ${wind ?? "--"}km/h</span>
          </div>
        </article>
      `;
    })
    .join("");
}

async function handleSearch(event) {
  event.preventDefault();
  const query = placeQuery.value.trim();
  if (!query) {
    placeStatus.textContent = "検索する地名を入力してください。";
    return;
  }

  placeStatus.textContent = "地名を検索しています。";
  searchResults.innerHTML = "";

  try {
    const { results, usedQuery } = await searchLocations(query);
    if (!results.length) {
      placeStatus.textContent = "候補が見つかりませんでした。";
      return;
    }
    placeStatus.textContent = usedQuery === query ? `${results.length}件見つかりました。` : `${usedQuery}として${results.length}件見つかりました。`;
    searchResults.innerHTML = results.map((location) => renderPlaceCard(location, "search")).join("");
  } catch (error) {
    placeStatus.textContent = `検索できませんでした: ${error.message}`;
  }
}

async function searchLocations(query) {
  const variants = getSearchVariants(query);
  for (const variant of variants) {
    const data = await fetchJson(buildGeocodingUrl(variant));
    const results = Array.isArray(data.results) ? data.results.map(normalizeLocation) : [];
    if (results.length) return { results, usedQuery: variant };
  }
  return { results: [], usedQuery: variants[variants.length - 1] || query };
}

function getSearchVariants(query) {
  const trimmed = query.trim();
  const variants = [trimmed];
  const withoutSuffix = trimmed.replace(/[市町村区]$/, "");
  if (withoutSuffix && withoutSuffix !== trimmed) variants.push(withoutSuffix);
  const withoutStation = trimmed.replace(/駅$/, "");
  if (withoutStation && withoutStation !== trimmed) variants.push(withoutStation);
  return Array.from(new Set(variants));
}

function renderPlaceLists() {
  const active = getActiveLocation();
  savedPlaces.innerHTML = state.savedLocations.map((location) => renderPlaceCard(location, "saved", location.id === active.id)).join("");
}

function renderPlaceCard(location, mode, isActive = false) {
  const payload = encodeURIComponent(JSON.stringify(location));
  const canDelete = mode === "saved" && !location.pinned;
  return `
    <article class="place-card ${isActive ? "active" : ""}" data-location="${payload}">
      <div>
        <h3>${escapeHtml(location.name)}</h3>
        <p>${escapeHtml(location.admin || "緯度経度指定")} / ${round(location.latitude, 3)}, ${round(location.longitude, 3)}</p>
      </div>
      <div class="place-actions">
        <button class="place-action primary-action" type="button" data-action="use">使う</button>
        ${canDelete ? `<button class="place-action" type="button" data-action="delete"><svg><use href="#icon-trash"></use></svg></button>` : ""}
      </div>
    </article>
  `;
}

function handlePlaceAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const card = event.target.closest("[data-location]");
  if (!card) return;
  const location = JSON.parse(decodeURIComponent(card.dataset.location));

  if (button.dataset.action === "use") {
    setActiveLocation(location);
    placeStatus.textContent = `${location.name}を表示地点にしました。`;
  }

  if (button.dataset.action === "delete") {
    state.savedLocations = state.savedLocations.filter((saved) => saved.id !== location.id);
    if (state.activeLocationId === location.id) state.activeLocationId = defaultLocation.id;
    saveState();
    renderPlaceLists();
    fetchWeather();
  }
}

function useCurrentPosition() {
  if (!navigator.geolocation) {
    placeStatus.textContent = "このブラウザでは現在地を取得できません。";
    return;
  }

  placeStatus.textContent = "現在地の許可を待っています。";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const location = normalizeLocation({
        id: `gps-${round(position.coords.latitude, 4)}-${round(position.coords.longitude, 4)}`,
        name: "現在地",
        admin: "GPS",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timezone: "Asia/Tokyo",
      });
      setActiveLocation(location);
      placeStatus.textContent = "現在地を表示地点にしました。";
    },
    (error) => {
      placeStatus.textContent = `現在地を取得できませんでした: ${error.message}`;
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 15 * 60 * 1000 },
  );
}

function getBackupPayload() {
  return {
    app: "外出コンパス",
    version: cacheVersion,
    exportedAt: new Date().toISOString(),
    data: {
      activeLocationId: state.activeLocationId,
      savedLocations: state.savedLocations,
    },
  };
}

function exportBackup() {
  backupText.value = JSON.stringify(getBackupPayload(), null, 2);
  backupStatus.textContent = "バックアップJSONを書き出しました。";
}

async function copyBackup() {
  if (!backupText.value.trim()) exportBackup();
  try {
    await navigator.clipboard.writeText(backupText.value);
    backupStatus.textContent = "クリップボードにコピーしました。";
  } catch {
    backupText.select();
    backupStatus.textContent = "自動コピーできませんでした。選択して手動でコピーしてください。";
  }
}

function importBackup() {
  const raw = backupText.value.trim();
  if (!raw) {
    backupStatus.textContent = "復元するJSONを貼り付けてください。";
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    backupStatus.textContent = "JSONとして読み取れませんでした。";
    return;
  }

  const data = parsed.data || parsed;
  if (!Array.isArray(data.savedLocations)) {
    backupStatus.textContent = "外出コンパスのバックアップ形式ではありません。";
    return;
  }

  const confirmed = window.confirm("現在の保存地点を、貼り付けたバックアップで置き換えます。実行しますか？");
  if (!confirmed) {
    backupStatus.textContent = "復元をキャンセルしました。";
    return;
  }

  state.savedLocations = dedupeLocations([defaultLocation, ...data.savedLocations.map(normalizeLocation)]);
  state.activeLocationId = data.activeLocationId || defaultLocation.id;
  saveState();
  renderPlaceLists();
  fetchWeather();
  backupStatus.textContent = "バックアップから復元しました。";
}

function emptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function switchView(name) {
  for (const [viewName, element] of Object.entries(views)) {
    element.classList.toggle("active", viewName === name);
  }
  viewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });
  if (name === "info") {
    maybeFetchNews();
    maybeFetchEvents();
  }
}

function setAppUpdateStatus(message, canReload = false) {
  appUpdateStatus.textContent = message;
  reloadApp.hidden = !canReload;
  reloadApp.disabled = !canReload;
}

function showAppReloadButton(message = "更新を取得しました。再読み込みで反映します。") {
  setAppUpdateStatus(message, true);
}

function bindServiceWorkerUpdateEvents(registration) {
  if (!registration || serviceWorkerUpdateBindings.has(registration)) return;
  serviceWorkerUpdateBindings.add(registration);

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;

    setAppUpdateStatus("最新版を取得しています。", false);
    worker.addEventListener("statechange", () => {
      if (worker.state !== "installed") return;
      if (navigator.serviceWorker.controller) {
        showAppReloadButton();
      } else {
        setAppUpdateStatus("オフライン表示の準備ができました。");
      }
    });
  });
}

async function ensureServiceWorkerRegistration() {
  if (serviceWorkerRegistration) return serviceWorkerRegistration;
  const existing = await navigator.serviceWorker.getRegistration("./");
  serviceWorkerRegistration = existing || (await navigator.serviceWorker.register("./service-worker.js"));
  bindServiceWorkerUpdateEvents(serviceWorkerRegistration);
  return serviceWorkerRegistration;
}

async function checkForAppUpdate() {
  if (!("serviceWorker" in navigator)) {
    setAppUpdateStatus("このブラウザではPWA更新確認に対応していません。");
    return;
  }
  if (!["http:", "https:"].includes(window.location.protocol)) {
    setAppUpdateStatus("file://では更新確認を使えません。HTTPS公開版で利用してください。");
    return;
  }

  try {
    checkAppUpdate.disabled = true;
    setAppUpdateStatus("更新を確認しています。", false);
    const registration = await ensureServiceWorkerRegistration();
    await registration.update();

    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      showAppReloadButton();
      return;
    }

    if (registration.installing) {
      setAppUpdateStatus("最新版を取得しています。完了後に再読み込みできます。");
      return;
    }

    if (!reloadApp.hidden) return;
    setAppUpdateStatus(`最新です: ${formatUpdated(new Date().toISOString())}`);
  } catch (error) {
    setAppUpdateStatus(`更新確認に失敗しました。${String(error?.message || "")}`);
  } finally {
    checkAppUpdate.disabled = false;
  }
}

function reloadApplication() {
  appUpdateReloading = true;
  window.location.reload();
}

function bindEvents() {
  refreshNow.addEventListener("click", fetchWeather);
  connectCalendar.addEventListener("click", handleCalendarConnect);
  disconnectCalendar.addEventListener("click", disconnectGoogleCalendar);
  calendarRangeButtons.forEach((button) => {
    button.addEventListener("click", handleCalendarRangeChange);
  });
  transportModeButtons.forEach((button) => {
    button.addEventListener("click", handleTransportModeChange);
  });
  saveCalendarClient.addEventListener("click", saveCalendarClientId);
  clearCalendarClient.addEventListener("click", clearCalendarClientId);
  refreshNews.addEventListener("click", () => fetchNews(true));
  refreshEvents.addEventListener("click", () => fetchEvents(true));
  searchForm.addEventListener("submit", handleSearch);
  searchResults.addEventListener("click", handlePlaceAction);
  savedPlaces.addEventListener("click", handlePlaceAction);
  useGps.addEventListener("click", useCurrentPosition);
  checkAppUpdate.addEventListener("click", checkForAppUpdate);
  reloadApp.addEventListener("click", reloadApplication);
  exportData.addEventListener("click", exportBackup);
  copyData.addEventListener("click", copyBackup);
  importData.addEventListener("click", importBackup);

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!["http:", "https:"].includes(window.location.protocol)) return;

  navigator.serviceWorker
    .register("./service-worker.js")
    .then((registration) => {
      serviceWorkerRegistration = registration;
      bindServiceWorkerUpdateEvents(registration);
      if (registration.waiting) showAppReloadButton();
    })
    .catch(() => {
      setAppUpdateStatus("PWAキャッシュの準備に失敗しました。通信できる状態で再度開いてください。");
    });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (appUpdateReloading) return;
    showAppReloadButton("更新準備ができました。再読み込みで反映します。");
  });
}

function init() {
  todayLabel.textContent = formatDate(new Date());
  loadState();
  bindEvents();
  renderTransportModeControls();
  renderCalendarSettings();
  renderCalendarPreview();
  renderPlaceLists();
  if (state.newsCache) renderNews(state.newsCache, true);
  if (state.eventFeedCache) renderAutoEvents(state.eventFeedCache, true);

  if (state.cache) renderWeather(state.cache, true);
  fetchWeather();
  registerServiceWorker();
}

init();
