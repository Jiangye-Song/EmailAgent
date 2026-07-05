import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import PostgresAdapter from "@auth/pg-adapter";
import { compare } from "bcryptjs";
import { pool } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(pool),

  session: {
    // JWT strategy required for credentials provider
    strategy: "jwt",
  },

  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const { rows } = await pool.query<{
          id: string;
          email: string;
          name: string | null;
          password_hash: string | null;
          onboarding_completed: boolean;
        }>(
          `SELECT id, email, name, password_hash, onboarding_completed FROM users WHERE email = $1`,
          [email],
        );

        const user = rows[0];
        if (!user?.password_hash) return null;

        const valid = await compare(password, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          onboarding_completed: user.onboarding_completed,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.sub = user.id;
        token.onboardingCompleted =
          (user as { onboarding_completed?: boolean }).onboarding_completed ?? false;
      }
      // Re-query when the client calls update() after completing onboarding.
      if (trigger === "update" && token.sub) {
        const { rows } = await pool.query<{ onboarding_completed: boolean }>(
          `SELECT onboarding_completed FROM users WHERE id = $1`,
          [token.sub],
        );
        token.onboardingCompleted = rows[0]?.onboarding_completed ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.onboardingCompleted = (token.onboardingCompleted as boolean) ?? false;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});
