import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Sparkles, Shield, Eye, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageLayout from "@/components/layout/PageLayout";

const sections = [
  {
    icon: Brain,
    title: "Context-First AI",
    content: "We believe that AI is only as good as the context it consumes. GitPlus brings repository source and generated architecture notes into the workspace, so you can investigate answers against the code.",
  },
  {
    icon: Eye,
    title: "Radical Transparency",
    content: "Black boxes are for magic shows, not software engineering. File references and line numbers help you check AI-generated answers. Treat every insight as a starting point and verify it against the source.",
  },
  {
    icon: Shield,
    title: "Know What You Share",
    content: "Repository text may be stored for search and sent to external AI providers. Only connect code you are allowed to share, and review the privacy policy before connecting private repositories.",
  },
  {
    icon: Sparkles,
    title: "Clarity by Design",
    content: "Software is an art form. Our interface prioritizes readable source, clear navigation, and working information over visual decoration. We build tools that help you focus on the code.",
  },
];

const OurPhilosophy = () => (
  <PageLayout title="Engineering clarity." subtitle="The best way to understand software is to examine its current state." category="Our vision">
    <div className="mx-auto max-w-4xl">
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(({ icon: Icon, title, content }) => (
          <motion.section key={title} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.15 }} className="rounded-lg border border-border bg-card p-5">
            <Icon className="mb-3 h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary-foreground">{content}</p>
          </motion.section>
        ))}
      </div>
      <section className="mt-6 rounded-lg border border-border bg-card p-5 text-center">
        <h2 className="text-xl font-semibold">Join the movement</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-secondary-foreground">We are building a new standard for codebase intelligence. Help us define the future of software understanding.</p>
        <Button asChild className="mt-4 h-11 sm:h-10"><Link to="/">Get started</Link></Button>
      </section>
    </div>
  </PageLayout>
);

export default OurPhilosophy;
