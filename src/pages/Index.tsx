
import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import FeaturesSection from "@/components/sections/FeaturesSection";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import PricingSection from "@/components/sections/PricingSection";
import FAQSection from "@/components/sections/FAQSection";


const Index = () => {
  
  
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main>
        <HeroSection />
        <section id="features">
          <FeaturesSection />
        </section>
        <TestimonialsSection />
        <section id="pricing">
          <PricingSection />
        </section>
        <section id="faq">
          <FAQSection />
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
