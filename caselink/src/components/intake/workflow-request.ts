/** Cookie bootstrap is a zero-call server handshake, not an additional research attempt. */
export async function postWorkflow(url: '/api/analyze' | '/api/intake', payload: unknown, signal: AbortSignal) {
  const options: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal, body: JSON.stringify(payload) };
  let response = await fetch(url, options); let body = await response.json();
  if (!response.ok && body.code === 'REQUEST_IN_PROGRESS' && body.retryAfterSeconds === 0 && !signal.aborted) {
    // Exactly once, same request ID and input version. Real in-progress work (>0s) is never restarted.
    response = await fetch(url, options); body = await response.json();
  }
  return { response, body };
}
