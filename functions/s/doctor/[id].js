const BACKEND = 'https://doctors-consultation-backend.onrender.com/api/v1';

export async function onRequestGet({ params, request }) {
  const upstreamUrl = `${BACKEND}/profilecard/${encodeURIComponent(params.id)}/share`;

  const upstream = await fetch(upstreamUrl, {
    headers: {
      // Forward the crawler's UA so the backend behaves identically
      'User-Agent': request.headers.get('User-Agent') || 'cloudflare-pages-proxy',
    },
    redirect: 'follow',
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'text/html',
      // Short cache — the page's only job is to serve OG tags
      'Cache-Control': 'public, max-age=300',
    },
  });
}
