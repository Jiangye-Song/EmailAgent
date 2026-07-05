// Type augmentation so session.user.id and session.user.onboardingCompleted are typed throughout the app
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      onboardingCompleted: boolean;
    } & DefaultSession["user"];
  }
}
