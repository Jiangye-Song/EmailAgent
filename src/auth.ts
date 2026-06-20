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
          // offline access → gets refresh_token on first consent
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          // Gmail + Calendar scopes on top of the default openid/email/profile
          scope: [
            "openid",
            "email",
            "profile",
            "https://mail.google.com/",
            "https://www.googleapis.com/auth/calendar",
          ].join(" "),
        },
      },
    }),
  ],

  callbacks: {
    // Expose user.id on the session so server components can read it
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});
