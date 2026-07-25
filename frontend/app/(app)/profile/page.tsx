"use client";

import { UserProfile } from "@clerk/nextjs";
import { PageTransition } from "@/components/shared/page-transition";

export default function ProfilePage() {
  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-6 py-8 flex justify-center">
        <UserProfile />
      </div>
    </PageTransition>
  );
}
