"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginState = { error?: string };

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { error: "Invalid email or password" };
  }
  if (!user.active) {
    return { error: "This account is disabled" };
  }

  await createSession({ userId: user.id, name: user.name, role: user.role }, user.tokenVersion);
  await logActivity({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id });

  redirect(user.role === "ADMIN" ? "/admin" : "/caller");
}

export async function logout() {
  const session = await getSession();
  if (session) {
    await logActivity({ userId: session.userId, action: "LOGOUT", entity: "User", entityId: session.userId });
  }
  await destroySession();
  redirect("/login");
}
