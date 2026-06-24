import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import PostgresAdapter from "@auth/pg-adapter";
import { pool } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(pool),

  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "online",
          response_type: "code",
          scope: "openid email profile",
        },
      },
    }),
  ],

  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});
