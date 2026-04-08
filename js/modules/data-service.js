const BASE_URL = '.';
const cache = new Map();

export async function getConfig() {
  return fetchJSON(`${BASE_URL}/data/config.json`, 'config');
}

export async function getCategories() {
  return fetchJSON(`${BASE_URL}/data/categories.json`, 'categories');
}

export async function getTransactions(yearMonth) {
  return fetchJSON(
    `${BASE_URL}/data/transactions/${yearMonth}.json`,
    `txn-${yearMonth}`
  );
}

export async function getPaymentMethods() {
  return fetchJSON(`${BASE_URL}/data/payment-methods.json`, 'payment-methods');
}

async function fetchJSON(url, cacheKey) {
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    cache.set(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

export function invalidateCache(key) {
  if (key) cache.delete(key);
  else cache.clear();
}
