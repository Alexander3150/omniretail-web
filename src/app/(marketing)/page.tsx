import LandingHero from "@/modules/marketing/components/LandingHero";
import LandingFeatures from "@/modules/marketing/components/LandingFeatures";
import LandingPricing from "@/modules/marketing/components/LandingPricing";
import LandingFaq from "@/modules/marketing/components/LandingFaq";

export default function MarketingPage() {
  return (
    <div className="bg-[var(--color-app-background)] min-h-screen">
      <LandingHero />
      <LandingFeatures />
      <LandingPricing />
      <LandingFaq />
    </div>
  );
}
