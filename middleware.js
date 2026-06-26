import { NextResponse } from 'next/server';

export async function middleware(request) {
  const apiBase = (process.env.API_PROXY_URL || 'http://localhost:8000').replace(/\/$/, '');
  const path = request.nextUrl.pathname + request.nextUrl.search;
  const target = `${apiBase}${path}`;

  const headers = new Headers(request.headers);
  headers.delete('connection');
  headers.set('x-forwarded-host', request.headers.get('host') || '');
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));

  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }

  try {
    const response = await fetch(target, init);
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error('API proxy error:', target, error);
    return NextResponse.json(
      { error: 'API server unavailable. Is the backend running?' },
      { status: 502 }
    );
  }
}

export const config = {
  matcher: '/api/:path*',
};
