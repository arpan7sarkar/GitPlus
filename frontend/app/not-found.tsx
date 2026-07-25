import { Metadata } from "next";

export const metadata: Metadata = { title: "Page Not Found" };

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[#F5F5F4] flex items-center justify-center mb-6">
        <span className="text-4xl font-bold text-[#C5C5C3]">404</span>
      </div>
      <h1 className="text-2xl font-bold text-[#111114] mb-2">Page not found</h1>
      <p className="text-sm text-[#5B5F66] mb-8 max-w-sm">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <a
        href="/"
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#4338CA] to-[#6366F1] text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all"
      >
        Go Home
      </a>
    </div>
  );
}
