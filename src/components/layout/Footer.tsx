import * as React from "react";
import { Mic, Twitter, Github, Mail } from "lucide-react";
import { SimpleNavigationLink as Link } from "@/components/navigation/SimpleNavigation";
const Footer = () => {
  const currentYear = new Date().getFullYear();
  const footerLinks = {
    Product: [{
      name: "How it Works",
      href: "/how-it-works"
    }, {
      name: "Features",
      href: "/#features"
    }, {
      name: "Pricing",
      href: "/#pricing"
    }, {
      name: "Help",
      href: "/help"
    }],
    Resources: [{
      name: "FAQ",
      href: "/#faq"
    }, {
      name: "Privacy Policy",
      href: "/privacy"
    }, {
      name: "Terms of Service",
      href: "/terms"
    }, {
      name: "Support",
      href: "/help"
    }],
    Company: [{
      name: "About",
      href: "/#about"
    }, {
      name: "Contact",
      href: "/help#contact"
    }, {
      name: "Privacy Policy",
      href: "/privacy"
    }, {
      name: "Terms of Service",
      href: "/terms"
    }],
    Community: [{
      name: "Success Stories",
      href: "/success-stories"
    }, {
      name: "Enterprise",
      href: "/enterprise"
    }, {
      name: "Help Center",
      href: "/help"
    }, {
      name: "Contact Support",
      href: "/help#contact"
    }]
  };
  return <footer className="bg-muted border-t border-border">
      <div className="container max-w-screen-xl mx-auto px-4 py-16">
        {/* Main Footer Content */}
        <div className="grid lg:grid-cols-6 gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center space-x-2 mb-4">
              
              <img src="/lovable-uploads/4d93c5dd-bdd8-4951-8fbb-4996db07b7c5.png" alt="NotaVoice" className="h-8 w-auto" />
            </Link>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Transform your voice into perfect text with AI-powered transcription. 
              Fast, accurate, and designed for students, professionals, and creators.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-muted-foreground hover:text-primary transition-smooth" aria-label="Twitter">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-smooth" aria-label="GitHub">
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-smooth" aria-label="Email">
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Links Columns */}
          {Object.entries(footerLinks).map(([category, links]) => <div key={category}>
              <h4 className="font-semibold text-foreground mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map(link => <li key={link.name}>
                    <Link to={link.href} className="text-muted-foreground hover:text-primary transition-smooth text-sm">
                      {link.name}
                    </Link>
                  </li>)}
              </ul>
            </div>)}
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center">
          <p className="text-muted-foreground text-sm">
            © {currentYear} NotaVoice. All rights reserved.
          </p>
          <div className="flex items-center space-x-6 mt-4 md:mt-0">
          </div>
        </div>
      </div>
    </footer>;
};
export default Footer;