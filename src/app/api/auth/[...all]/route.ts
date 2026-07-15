import { auth } from "@/server/auth/config";
import { toNextJsHandler } from "better-auth/next-js";
import {
  checkLockoutByEmail,
  recordLoginFailure,
  clearLoginFailures,
} from "@/server/auth/hooks/lockout";
import { writeAuditEvent } from "@/server/auth/hooks/audit";

/**
 * Better-Auth HTTP handler mounted at /api/auth/*.
 *
 * Phase 7 refactor: register / login / logout flow through Better-Auth's
 * native endpoints here (sets Set-Cookie correctly). Lockout logic (FR-009)
 * is injected as a wrapper around sign-in to preserve the same behavior as
 * the previous tRPC implementation.
 *
 * Per Clarification Q4: when locked, returns 423 with retryAfterSeconds.
 */
const betterAuthHandler = toNextJsHandler(auth);

async function readJsonBody(req: Request): Promise<{ body: any; reconstructed: Request }> {
  const text = await req.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    // not JSON, pass through
  }
  // Reconstruct the request because we consumed the body stream.
  // NOTE: undici's Request constructor has a bug when init source is another
  // Request with private state. Use req.url + fresh init instead.
  const reconstructed = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: text,
    // @ts-expect-error: duplex is needed for streaming body in Node fetch
    duplex: "half",
  });
  return { body, reconstructed };
}

function lockedResponse(retryAfterSeconds: number): Response {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return new Response(
    JSON.stringify({
      code: "LOCKED",
      message: `账户已锁定,请 ${minutes} 分钟后重试`,
      retryAfterSeconds,
    }),
    {
      status: 423,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Rewrite kebab-case paths from Better-Auth client SDK to slash convention.
 * Client sends /sign-in-email, server expects /sign-in/email.
 */
function rewritePath(url: URL): URL {
  const newPath = url.pathname
    .replace("/sign-in-email", "/sign-in/email")
    .replace("/sign-up-email", "/sign-up/email");
  if (newPath !== url.pathname) {
    const newUrl = new URL(newPath, url.origin);
    newUrl.search = url.search;
    return newUrl;
  }
  return url;
}

/**
 * Before the session cookie config was corrected, Better Auth used its
 * default cookie name. Expire both variants during logout so an old session
 * cannot become active again if cookie settings change between deployments.
 */
function clearLegacySessionCookies(response: Response): Response {
  const headers = new Headers(response.headers);
  const expired = "Max-Age=0; Path=/; HttpOnly; SameSite=Lax";

  headers.append(
    "Set-Cookie",
    `better-auth.session_token=; ${expired}`
  );
  headers.append(
    "Set-Cookie",
    `__Secure-better-auth.session_token=; ${expired}; Secure`
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const POST = async (req: Request): Promise<Response> => {
  const originalUrl = new URL(req.url);
  const rewrittenUrl = rewritePath(originalUrl);
  const path = rewrittenUrl.pathname.replace(/^\/api\/auth/, "");

  // If URL was rewritten, create a new request with correct URL for Better-Auth
  if (rewrittenUrl.pathname !== originalUrl.pathname) {
    const text = await req.text();
    req = new Request(rewrittenUrl, {
      method: req.method,
      headers: req.headers,
      body: text,
      // @ts-expect-error: duplex is needed for streaming body in Node fetch
      duplex: "half",
    });
  }

  // ─── Sign-in lockout wrapper ───────────────────────────────────────────
  if (path === "/sign-in/email") {
    const { body, reconstructed } = await readJsonBody(req);
    const email: string | undefined = body?.email;

    if (email) {
      // Pre-check: if already locked, reject without invoking Better-Auth
      const decision = await checkLockoutByEmail(email);
      if (decision.status === "locked") {
        return lockedResponse(decision.retryAfterSeconds ?? 300);
      }

      // Invoke Better-Auth
      const upstream = await betterAuthHandler.POST!(reconstructed);

      if (upstream.status === 200) {
        // Success: clear counter
        await clearLoginFailures(email);
      } else {
        // Failure: increment counter, write audit, possibly trigger lockout
        const failResult = await recordLoginFailure(email);
        try {
          await writeAuditEvent({
            eventType: "login_failure",
            email,
            outcome: "failure",
          });
        } catch {
          // swallow
        }
        if (failResult.triggeredLockout) {
          try {
            await writeAuditEvent({
              eventType: "lockout_triggered",
              email,
              outcome: "failure",
              metadata: { retryAfterSeconds: failResult.retryAfterSeconds ?? 300 },
            });
          } catch {
            // swallow
          }
        }
      }

      return upstream;
    }
  }

  if (path === "/sign-out") {
    const upstream = await betterAuthHandler.POST!(req);
    return clearLegacySessionCookies(upstream);
  }

  // ─── All other auth endpoints: pass through ────────────────────────────
  return betterAuthHandler.POST!(req);
};

export const GET = betterAuthHandler.GET!;
