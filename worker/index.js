const SESSION_ID = '5cc524e5-8b5b-48a2-bc0d-e8ecd80fa30a';

/** Frontend-only session handler used by the AlterU self-hosted deployer. */
export async function handleApi(request) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname.endsWith('/api/health')) {
    return Response.json({
      ok: true,
      game: 'edge-brake',
      sessionId: SESSION_ID,
      mode: 'frontend-only',
    });
  }
  return new Response('Not Found', { status: 404 });
}
