const PREFIX = "dms_api_cache:v2:";
const DEFAULT_TTL = 5 * 60 * 1000;

const cacheOwner = () => {
  try {
    const user = JSON.parse(localStorage.getItem("dms_user"));
    return user?.id || user?.email || "anonymous";
  } catch {
    return "anonymous";
  }
};

const keyFor = (url, params) => `${PREFIX}${cacheOwner()}:${url}:${JSON.stringify(params || {})}`;

export async function cachedGet(api, url, config = {}, options = {}) {
  const { ttl = DEFAULT_TTL, force = false } = options;
  const key = keyFor(url, config.params);
  if (!force) {
    try {
      const cached = JSON.parse(sessionStorage.getItem(key));
      if (cached && Date.now() - cached.savedAt < ttl) return { data: cached.data, cached: true };
    } catch {
      sessionStorage.removeItem(key);
    }
  }

  const response = await api.get(url, config);
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data: response.data }));
  } catch {
    // Storage may be unavailable or full; the request result is still usable.
  }
  return response;
}

export function invalidateApiCache(urlPrefix = "") {
  const prefix = `${PREFIX}${cacheOwner()}:${urlPrefix}`;
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
  }
}
