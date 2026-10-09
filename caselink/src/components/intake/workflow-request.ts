/** Each explicit user action sends one request. No cookie handshake or automatic replay. */
export async function postWorkflow(url: '/api/analyze' | '/api/intake', payload: unknown, signal: AbortSignal) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal, body: JSON.stringify(payload) });
  return { response, body: await response.json() };
}
