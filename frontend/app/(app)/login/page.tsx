"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <SignIn routing="hash" />
    </div>
  );
}
