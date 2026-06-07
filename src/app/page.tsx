import { Hero } from "./_components/hero";
import { HowItWorks } from "./_components/how-it-works";

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <Hero />
      <HowItWorks />
    </main>
  );
}
