import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { isAdminEmail } from "@/lib/roles";
import { isGoogleAuthEnabled } from "@/lib/googleAuthEnabled";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const googleConfigured = isGoogleAuthEnabled();

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The Prisma adapter persists Google sign-ins (User/Account rows) so the
  // same person always resolves to the same account; sessions still stay
  // JWT (serverless-friendly, no Session/VerificationToken table needed) —
  // the Credentials provider never touches the adapter at all, by Auth.js
  // design, so this changes nothing about the existing email/password flow.
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        // No password hash means this account has only ever signed in with
        // Google — nothing for the credentials form to check against.
        if (!user || !user.passwordHash) return null;

        const passwordsMatch = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!passwordsMatch) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
    ...(googleConfigured
      ? [
          Google({
            clientId: env.AUTH_GOOGLE_ID,
            clientSecret: env.AUTH_GOOGLE_SECRET,
            // If someone already has an email/password account and signs in
            // with Google using the same address, link the Google account to
            // it instead of refusing with an "account not linked" error.
            // This is "dangerous" in Auth.js's naming because it isn't safe
            // in general — a provider that doesn't verify email ownership
            // could let an attacker claim someone else's account just by
            // typing their email. Google does verify it (you can only
            // authenticate as an address you control), and it's the only
            // other provider configured here, so that risk doesn't apply.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    // Keeps the admin bootstrap (see lib/roles.ts) working for Google too:
    // by the time this runs, the adapter has already created or resolved
    // the User row, so just make sure its role matches.
    signIn: async ({ user, account }) => {
      if (account?.provider === "google" && user?.id && user.email && isAdminEmail(user.email)) {
        await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } }).catch(() => {});
      }
      return true;
    },
  },
});
