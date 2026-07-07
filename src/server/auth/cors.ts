export function setCorsHeaders(res: Response): Response {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, PATCH, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key");
  return res;
}

export function corsPreflightResponse(): Response {
  return setCorsHeaders(new Response(null, { status: 204 }));
}
