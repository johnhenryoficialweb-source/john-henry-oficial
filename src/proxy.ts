import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * En Next.js 16 "Middleware" se renombró a "Proxy" (misma funcionalidad).
 * Aquí solo se hace el check optimista de sesión (lee la cookie, no la BD)
 * para refrescar el token de Supabase y redirigir a /login sin sesión.
 * La autorización real (rol/sede) se verifica siempre en el servidor vía
 * src/lib/auth/roles.ts (Data Access Layer), nunca solo aquí.
 *
 * Importante: no redirigir /login → /dashboard solo por Auth.
 * Si el usuario está autenticado pero no es staff, requireStaffSession
 * redirige a /login y se forma un bucle infinito.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isCmsRoute =
    path.startsWith("/dashboard") ||
    path.startsWith("/appointments") ||
    path.startsWith("/clients") ||
    path.startsWith("/fabrics") ||
    path.startsWith("/orders") ||
    path.startsWith("/finance") ||
    path.startsWith("/settings");

  if (isCmsRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    }
    return redirectResponse;
  }

  return response;
}

export const config = {
  // Los artefactos de la PWA (worker, manifiesto y pantalla offline) quedan
  // fuera: son públicos por definición y no deben costar un round-trip a
  // Supabase — el worker se pide en cada arranque de la app instalada.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|offline|icons/|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
