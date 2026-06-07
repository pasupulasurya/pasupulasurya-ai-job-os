import { AmbientBg } from "./_components/ambient-bg";
import { Hero } from "./_components/hero";
import { HowItWorks } from "./_components/how-it-works";
import { WhatsNext } from "./_components/whats-next";

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <AmbientBg />
      <Hero />
      <HowItWorks />
      <WhatsNext />
    </main>
  );
}
