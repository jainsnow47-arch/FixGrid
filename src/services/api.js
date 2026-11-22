let authToken = null;

export function setAuthToken(token) {
  authToken = token || null;
}

export function getAuthToken() {
  return authToken;
}

export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, isFormData = false, headers = {} } = options;
  const finalHeaders = { ...headers };

  if (authToken) {
    finalHeaders.Authorization = `Bearer ${authToken}`;
  }
  if (!isFormData && body && !finalHeaders['Content-Type']) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, {
    method,
    headers: finalHeaders,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof data === 'object' && data?.error ? data.error : 'Request failed.';
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return data;
}
