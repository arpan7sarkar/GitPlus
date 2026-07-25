const LOGOS = [
  "Stripe", "Vercel", "Linear", "Notion", "Figma",
  "Supabase", "Resend", "PlanetScale", "Raycast",
];

export function LogoStrip() {
  return (
    <div className="py-12 border-y border-[#E5E5E3] bg-[#FAFAFA] overflow-hidden">
      <p className="text-center text-xs font-semibold text-[#5B5F66] uppercase tracking-widest mb-8">
        Trusted by developers at world-class teams
      </p>
      <div className="flex items-center justify-center flex-wrap gap-8 px-8">
        {LOGOS.map((logo) => (
          <span
            key={logo}
            className="text-sm font-semibold text-[#C5C5C3] hover:text-[#5B5F66] transition-colors cursor-default select-none"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {logo}
          </span>
        ))}
      </div>
    </div>
  );
}
