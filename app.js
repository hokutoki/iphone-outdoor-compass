const storageKey = "iphone-outdoor-compass-v1";
const cacheVersion = 1;
const eventFeedUrl = "./data/events.json";
const calendarScope = "https://www.googleapis.com/auth/calendar.events.readonly";
const calendarApiBaseUrl = "https://www.googleapis.com/calendar/v3";
const googleIdentityScriptUrl = "https://accounts.google.com/gsi/client";
const defaultCalendarClientId = "176925321769-f8r8ic1bvbd84tn1co66bl3ibeuqo4ai.apps.googleusercontent.com";
const defaultCalendarRangeMode = "week";
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
const calendarClientIdInput = document.querySelector("#calendar-client-id");
const saveCalendarClient = document.querySelector("#save-calendar-client");
const clearCalendarClient = document.querySelector("#clear-calendar-client");
const calendarSettingsStatus = document.querySelector("#calendar-settings-status");

let googleIdentityScriptPromise = null;
let calendarTokenClient = null;

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
  } catch {
    state.activeLocationId = defaultLocation.id;
    state.savedLocations = [defaultLocation];
    state.cache = null;
    state.newsCache = null;
    state.eventFeedCache = null;
    state.calendarClientId = "";
    state.calendarRangeMode = defaultCalendarRangeMode;
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
}

function renderError(error) {
  scoreRing.style.setProperty("--score", 0);
  scoreValue.textContent = "--";
  conditionLabel.textContent = "取得できませんでした";
  conditionSummary.textContent = error?.message || "通信状態を確認してください。";
  updatedLabel.textContent = "前回データなし";
  metricGrid.innerHTML = emptyState("表示できる天気データがありません。");
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

  activeLocationLabel.innerHTML = `<svg><use href="#icon-pin"></use></svg>${escapeHtml(location.name)}`;
  scoreRing.style.setProperty("--score", scores.outdoor);
  scoreRing.style.setProperty("--score-color", getScoreColor(scores.outdoor));
  scoreValue.textContent = String(scores.outdoor);
  conditionLabel.textContent = getScoreLabel(scores.outdoor);
  conditionSummary.textContent = getWeatherName(current.weather_code);
  updatedLabel.textContent = isStale
    ? `前回データ: ${formatUpdated(fetchedAt)}`
    : formatUpdated(fetchedAt);

  if (isStale && error) {
    adviceList.innerHTML = renderAdvice([`通信できないため前回取得データを表示しています。`, ...scores.advice]);
  } else {
    adviceList.innerHTML = renderAdvice(scores.advice);
  }

  metricGrid.innerHTML = renderMetrics(current, airCurrent, hours);
  activityGrid.innerHTML = renderActivities(scores.activities);
  hourlyList.innerHTML = renderHours(hours);
  dailyList.innerHTML = renderDaily(forecast);
  renderPlaceLists();
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

  const outdoor = Math.round(
    tempScore * 0.26 +
      rainScore * 0.3 +
      windScore * 0.18 +
      airScore * 0.16 +
      uvScore * 0.1,
  );

  const walk = Math.round(outdoor);
  const laundry = Math.round(clamp(rainScore * 0.45 + (100 - cloud) * 0.25 + windScore * 0.15 + tempScore * 0.15, 0, 100));
  const shopping = Math.round(clamp(outdoor * 0.75 + rainScore * 0.15 + windScore * 0.1, 0, 100));
  const drive = Math.round(clamp(100 - nextRainProbability * 0.45 - Math.max(0, gust - 35) * 2.4, 0, 100));

  const advice = buildAdvice({ apparent, nextRainProbability, nextPrecipitation, wind, gust, pm25, uv, outdoor });

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
  if (values.nextRainProbability >= 60 || values.nextPrecipitation >= 2) {
    advice.push("雨の可能性が高めです。外出するなら傘と短い用事中心が無難です。");
  } else if (values.nextRainProbability <= 25) {
    advice.push("雨の心配は小さめです。短い外出や散歩を入れやすい条件です。");
  }

  if (values.gust >= 35 || values.wind >= 24) {
    advice.push("風が強めです。自転車、洗濯物、傘の扱いに注意してください。");
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
    advice.push("体感温度が高いです。徒歩移動は短めにして水分を用意してください。");
  }

  if (!advice.length) {
    advice.push(values.outdoor >= 70 ? "大きな注意条件は少なめです。外で済む用事を入れやすいです。" : "条件は中間です。近場の用事から選ぶのが現実的です。");
  }

  return advice.slice(0, 3);
}

function scoreText(score, good, warn, bad) {
  if (score >= 72) return good;
  if (score >= 48) return warn;
  return bad;
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

function computeHourScore(hour) {
  const temp = Number(hour.apparent ?? hour.temperature ?? 20);
  const tempScore = 100 - Math.min(Math.abs(temp - 21) * 5.5, 70);
  const rainScore = clamp(100 - Number(hour.rainProbability || 0) * 0.85 - Number(hour.precipitation || 0) * 10, 0, 100);
  const windScore = clamp(100 - Math.max(0, Number(hour.wind || 0) - 12) * 3, 0, 100);
  const airScore = clamp(100 - Math.max(0, Number(hour.pm25 || 0) - 12) * 2.8, 0, 100);
  const uvScore = clamp(100 - Math.max(0, Number(hour.uv || 0) - 5) * 12, 0, 100);
  return Math.round(tempScore * 0.24 + rainScore * 0.34 + windScore * 0.18 + airScore * 0.14 + uvScore * 0.1);
}

function renderDaily(forecast) {
  const daily = forecast.daily || {};
  if (!Array.isArray(daily.time)) return emptyState("日別データがありません。");

  return daily.time
    .map((time, index) => {
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

function bindEvents() {
  refreshNow.addEventListener("click", fetchWeather);
  connectCalendar.addEventListener("click", handleCalendarConnect);
  disconnectCalendar.addEventListener("click", disconnectGoogleCalendar);
  calendarRangeButtons.forEach((button) => {
    button.addEventListener("click", handleCalendarRangeChange);
  });
  saveCalendarClient.addEventListener("click", saveCalendarClientId);
  clearCalendarClient.addEventListener("click", clearCalendarClientId);
  refreshNews.addEventListener("click", () => fetchNews(true));
  refreshEvents.addEventListener("click", () => fetchEvents(true));
  searchForm.addEventListener("submit", handleSearch);
  searchResults.addEventListener("click", handlePlaceAction);
  savedPlaces.addEventListener("click", handlePlaceAction);
  useGps.addEventListener("click", useCurrentPosition);
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
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

function init() {
  todayLabel.textContent = formatDate(new Date());
  loadState();
  bindEvents();
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
