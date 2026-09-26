import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Authentication
 * ==============
 *
 * Two *separate* credentials providers, on purpose:
 *
 *   credentials  — a normal mess owner. `isAdmin` is hard-coded to false, so no
 *                  database value can ever escalate this session.
 *   superadmin   — the platform owner. Credentials come from env only and are
 *                  compared in constant time; this is the single code path that
 *                  can set `isAdmin: true`. It has no mess, so it can never be
 *                  mistaken for a tenant.
 *
 * Because `isAdmin` is stamped at sign-in time from the provider that handled
 * the request, a user cannot obtain admin rights by tampering with the session
 * cookie (it is HMAC-signed and holds no user-controlled role).
 */

const SUPER_ADMIN_ID = "superadmin";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Constant-time string compare that tolerates differing lengths. */
function safeEqual(a, b) {
  const ha = createHash("sha256").update(String(a), "utf8").digest();
  const hb = createHash("sha256").update(String(b), "utf8").digest();
  return timingSafeEqual(ha, hb);
}

function readCredentials(credentials) {
  const email = typeof credentials?.email === "string" ? credentials.email.trim() : "";
  const password = typeof credentials?.password === "string" ? credentials.password : "";
  return { email, password };
}

async function authorizeMessOwner(credentials) {
  const { email, password } = readCredentials(credentials);
  if (!email || !password) return null;

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { mess: { select: { id: true, name: true } } },
  });

  // Same response for "no such user" and "wrong password" so the form cannot
  // be used to enumerate which emails have accounts.
  if (!user || !user.mess) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  if (user.suspended) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: false,
    messId: user.mess.id,
    messName: user.mess.name,
  };
}

async function authorizeSuperAdmin(credentials) {
  const { email, password } = readCredentials(credentials);
  if (!email || !password) return null;

  const expectedEmail = process.env.SUPER_ADMIN_EMAIL;
  const expectedPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) {
    console.error("[auth] SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD are not set; /admin-login is disabled.");
    return null;
  }

  const emailMatches = safeEqual(email.toLowerCase(), expectedEmail.trim().toLowerCase());
  const passwordMatches = safeEqual(password, expectedPassword);
  if (!emailMatches || !passwordMatches) return null;

  return {
    id: SUPER_ADMIN_ID,
    name: "Super Admin",
    email: expectedEmail,
    isAdmin: true,
    messId: null,
    messName: null,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: authorizeMessOwner,
    }),
    Credentials({
      id: "superadmin",
      name: "Super admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: authorizeSuperAdmin,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.isAdmin = Boolean(user.isAdmin);
        token.messId = user.messId ?? null;
        token.messName = user.messName ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? token.sub ?? "";
        session.user.isAdmin = Boolean(token.isAdmin);
        session.user.messId = token.messId ?? null;
        session.user.messName = token.messName ?? null;
      }
      return session;
    },
  },
  events: {
    /** Best-effort login bookkeeping — must never block the sign-in. */
    async signIn({ user }) {
      if (!user?.id || user.id === SUPER_ADMIN_ID) return;
      try {
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      } catch (error) {
        console.error("[auth] failed to record lastLoginAt", error);
      }
    },
  },
});
