/**
 * Session Helper
 * Opaque-token sessions backed by the Postgres `sessions` table (see schema.prisma).
 * The session token itself is the cookie value — high-entropy enough (32 random
 * bytes) that it doesn't need separate signing; the DB lookup is the source of truth.
 */

import crypto from "crypto";
import type { Request } from "express";
import { prisma } from "./prisma.js";

export const SESSION_COOKIE = "gitplus_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

export async function getSessionUser(token: string | undefined) {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token } }).catch(() => {});
    return null;
  }

  return session.user;
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  await prisma.session.delete({ where: { token } }).catch(() => {});
}

export function readSessionToken(req: Request): string | undefined {
  return (req as any).cookies?.[SESSION_COOKIE];
}
