import { AmbientBg } from "./_components/ambient-bg";
import { Hero } from "./_components/hero";
import { HowItWorks } from "./_components/how-it-works";
import { WhatsNext } from "./_components/whats-next";
import { FinalCta } from "./_components/final-cta";

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <AmbientBg />
      <div className="border-border/60 relative mx-auto max-w-7xl border-x">
        <Hero />
        <HowItWorks />
        <WhatsNext />
        <FinalCta />
      </div>
    </main>
  );
}
