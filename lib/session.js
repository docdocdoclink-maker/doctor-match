import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export const sessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    "a-very-long-development-only-secret-password-change-me-12345",
  cookieName: "doctormatch_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession(cookieStore, sessionOptions);
}
