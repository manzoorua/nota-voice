import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import SimpleNavigationLink from "@/components/navigation/SimpleNavigation";

const PublicHeader = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new CustomEvent('navigate', { detail: { path } }));
    }
  };

  const handleNavItemClick = (path: string) => {
    setIsMobileMenuOpen(false);
    navigate(path);
  };

  const navLinks = [{
    href: "/",
    label: "Home"
  }, {
    href: "/how-it-works",
    label: "How It Works"
  }, {
    href: "/pricing",
    label: "Pricing"
  }, {
    href: "/help",
    label: "Help"
  }];

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <SimpleNavigationLink 
            to="/" 
            className="mr-6 flex items-center space-x-2"
          >
            <img 
              src="/lovable-uploads/4d93c5dd-bdd8-4951-8fbb-4996db07b7c5.png" 
              alt="NotaVoice" 
              className="h-8 w-auto hidden sm:inline-block"
            />
          </SimpleNavigationLink>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navLinks.map((link) => (
              <SimpleNavigationLink
                key={link.href}
                to={link.href}
                className={`transition-colors hover:text-foreground/80 ${
                  currentPath === link.href 
                    ? "text-foreground" 
                    : "text-foreground/60"
                }`}
              >
                {link.label}
              </SimpleNavigationLink>
            ))}
          </nav>
        </div>

        {/* Mobile menu */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="pr-0">
            <SimpleNavigationLink
              to="/"
              className="flex items-center"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <img 
                src="/lovable-uploads/4d93c5dd-bdd8-4951-8fbb-4996db07b7c5.png" 
                alt="NotaVoice" 
                className="h-8 w-auto"
              />
            </SimpleNavigationLink>
            <div className="my-4 h-[calc(100vh-8rem)] pb-10 pl-6">
              <div className="flex flex-col space-y-3">
                {navLinks.map((link) => (
                  <SimpleNavigationLink
                    key={link.href}
                    to={link.href}
                    onClick={() => handleNavItemClick(link.href)}
                    className={`transition-colors hover:text-foreground/80 ${
                      currentPath === link.href 
                        ? "text-foreground" 
                        : "text-foreground/60"
                    }`}
                  >
                    {link.label}
                  </SimpleNavigationLink>
                ))}
                <Separator />
                <div className="flex flex-col space-y-3">
                  <SimpleNavigationLink
                    to="/signin"
                    onClick={() => handleNavItemClick('/signin')}
                    className="transition-colors hover:text-foreground/80 text-foreground/60"
                  >
                    Sign In
                  </SimpleNavigationLink>
                  <SimpleNavigationLink
                    to="/signup"
                    onClick={() => handleNavItemClick('/signup')}
                    className="transition-colors hover:text-foreground/80 text-foreground/60"
                  >
                    Sign Up
                  </SimpleNavigationLink>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <SimpleNavigationLink 
              to="/" 
              className="flex items-center space-x-2 md:hidden"
            >
              <img 
                src="/lovable-uploads/4d93c5dd-bdd8-4951-8fbb-4996db07b7c5.png" 
                alt="NotaVoice" 
                className="h-8 w-auto"
              />
            </SimpleNavigationLink>
          </div>
          <nav className="flex items-center space-x-2">
            <div className="hidden md:flex items-center space-x-2">
              <Button variant="ghost" onClick={() => navigate('/signin')}>
                Sign In
              </Button>
              <Button variant="hero" onClick={() => navigate('/signup')}>
                Start Free
              </Button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default PublicHeader;