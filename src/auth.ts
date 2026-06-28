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
        }>(
          `SELECT id, email, name, password_hash FROM users WHERE email = $1`,
          [email],
        );

        const user = rows[0];
        if (!user?.password_hash) return null;

        const valid = await compare(password, user.password_hash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],

  callbacks: {
    // With JWT strategy, expose user.id via token.sub
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});
