import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

const COOKIE = "cp_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // session timeout: 8h

export type Session = {
  userId: string;
  name: string;
  role: Role;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function createSession(session: Session, tokenVersion: number) {
  const token = await new SignJWT({ ...session, v: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = payload.userId as string;
    // A session is only valid if the account still exists, is active, and its token
    // version still matches — a password change bumps the version and kills old sessions.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true, active: true },
    });
    if (!user || !user.active || user.tokenVersion !== (payload.v as number)) return null;
    return {
      userId,
      name: payload.name as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/caller");
  return session;
}

export async function requireCaller(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "TELECALLER") redirect("/admin");
  return session;
}
