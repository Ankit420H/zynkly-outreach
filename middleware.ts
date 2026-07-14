import { auth } from "@/lib/auth";

export const middleware = auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|api/inngest|login).*)"],
};
