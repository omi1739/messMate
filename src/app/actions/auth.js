"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { assertSameOrigin, getCurrentUser, requireMessId } from "@/lib/dal";
import { changePasswordSchema, loginSchema, signupSchema } from "@/lib/validators";
import { fail, fieldErrors, formString, safeNextPath, succeed } from "@/lib/action-state";

const BCRYPT_ROUNDS = 12;

function superAdminEmail() {
  return (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
}

/** Create the account and its mess, then sign in. */
export async function signupAction(_prevState, formData) {
  await assertSameOrigin();

  const parsed = signupSchema.safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    messName: formString(formData, "messName"),
  });

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const { name, email, password, messName } = parsed.data;

  if (email === superAdminEmail()) {
    return fail("That email is reserved.", {
      email: "This email cannot be used to sign up.",
    });
  }

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return fail("That email is already registered.", {
      email: "An account with this email already exists. Try signing in instead.",
    });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // One signup = one mess. The nested create keeps them in a single insert, so a
  // user can never end up without a mess or own two.
  await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      mess: { create: { name: messName } },
    },
    select: { id: true },
  });

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  return succeed("Welcome to MessMate!");
}

/** Standard mess-owner sign-in. */
export async function loginAction(_prevState, formData) {
  await assertSameOrigin();

  const parsed = loginSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });

  if (!parsed.success) {
    return fail("Enter your email and password.", fieldErrors(parsed.error));
  }

  const { email, password } = parsed.data;
  const redirectTo = safeNextPath(formString(formData, "next"), "/dashboard");

  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(
        error.type === "CredentialsSignin"
          ? "That email and password combination is not correct."
          : "We could not sign you in. Please try again.",
      );
    }
    // Anything else (notably the post-sign-in redirect) must keep bubbling.
    throw error;
  }

  return succeed("Signed in.");
}

/** Super-admin sign-in. Uses the separate provider, so `isAdmin` is set here and
 *  nowhere else in the codebase. */
export async function adminLoginAction(_prevState, formData) {
  await assertSameOrigin();

  const parsed = loginSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });

  if (!parsed.success) {
    return fail("Enter the admin email and password.", fieldErrors(parsed.error));
  }

  try {
    await signIn("superadmin", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/admin",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail("Those admin credentials are not correct.");
    }
    throw error;
  }

  return succeed("Signed in as super admin.");
}

export async function logoutAction() {
  await assertSameOrigin();
  await signOut({ redirectTo: "/" });
}

export async function changePasswordAction(_prevState, formData) {
  await assertSameOrigin();

  const user = await getCurrentUser();
  if (!user) return fail("You are signed out.");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formString(formData, "currentPassword"),
    newPassword: formString(formData, "newPassword"),
  });

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return fail("Your account could not be found.");

  const valid = await bcrypt.compare(parsed.data.currentPassword, record.passwordHash);
  if (!valid) {
    return fail("That is not your current password.", {
      currentPassword: "Incorrect password.",
    });
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS) },
  });

  return succeed("Password updated.");
}

export async function updateProfileAction(_prevState, formData) {
  await assertSameOrigin();
  await requireMessId();

  const user = await getCurrentUser();
  if (!user) return fail("You are signed out.");

  const name = formString(formData, "name").trim();
  if (name.length < 2 || name.length > 60) {
    return fail("Please fix the highlighted fields.", {
      name: "Name must be between 2 and 60 characters.",
    });
  }

  await db.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/settings");
  return succeed("Profile updated.");
}
