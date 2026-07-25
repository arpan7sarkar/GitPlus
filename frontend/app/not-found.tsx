import Link from "next/link";
import { Code2 } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] px-6">
      <div className="w-16 h-16 rounded-2xl bg-[#F5F5F4] flex items-center justify-center mb-6">
        <Code2 className="h-7 w-7 text-[#C5C5C3]" />
      </div>
      <h1 className="text-6xl font-bold text-[#111114] mb-3">404</h1>
      <p className="text-lg text-[#5B5F66] mb-8">Page not found</p>
      <Link
        href="/"
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#4338CA] to-[#6366F1] text-white font-semibold text-sm shadow-sm hover:shadow-md transition-shadow"
      >
        Go Home
      </Link>
    </div>
  );
}
