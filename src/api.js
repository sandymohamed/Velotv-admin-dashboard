export const API_URL = (window.VELOTV_CONFIG?.API_URL || '').replace(/\/+$/, '');

export async function request(path, { token, body, key, signal, method } = {}) {
  let response;
  try {
    response = await fetch(API_URL + path, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: 'Bearer ' + token }),
        ...(key && { 'Idempotency-Key': key }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      cache: 'no-store',
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Could not reach the API. Check the server address and allowed dashboard origin.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.error === true || data.success === false) {
    const error = new Error(data?.message || (data?.success === false && data.result) || 'The API could not complete the request.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function checkout(redirectUrl) {
  const url = new URL(redirectUrl);
  if (url.protocol !== 'https:' || url.username || url.password ||
      !['www.paypal.com', 'www.sandbox.paypal.com'].includes(url.hostname)) {
    throw new Error('The API returned an invalid PayPal checkout link.');
  }
  window.location.assign(url.href);
}
