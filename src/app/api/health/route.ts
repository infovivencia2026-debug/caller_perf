import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Deployment diagnostics. Reports whether the server can reach the database and, when
 * it cannot, why — production error pages deliberately hide that, which makes a broken
 * deployment very hard to diagnose from outside.
 *
 * Connection strings contain the password, so nothing derived from DATABASE_URL is
 * echoed: only whether each variable is present, and a scrubbed error message.
 */
function scrub(message: string) {
  return message
    // postgres://user:password@host/db -> postgres://***@host/db
    .replace(/(\w+:\/\/)[^@\s]*@/g, "$1***@")
    .slice(0, 300);
}

export async function GET() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    DIRECT_URL: Boolean(process.env.DIRECT_URL),
    SESSION_SECRET: Boolean(process.env.SESSION_SECRET),
  };

  try {
    const rows = await prisma.$queryRaw<{ n: number }[]>`SELECT 1 AS n`;
    const users = await prisma.user.count();
    return NextResponse.json({ ok: rows.length === 1, env, users });
  } catch (error) {
    const err = error as { name?: string; code?: string; message?: string };
    return NextResponse.json(
      {
        ok: false,
        env,
        error: { name: err.name, code: err.code, message: scrub(err.message ?? String(error)) },
      },
      { status: 500 },
    );
  }
}
