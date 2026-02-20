import { useState, useMemo } from "react";
import { Menu, User, Settings, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import SimpleNavigationLink from "@/components/navigation/SimpleNavigation";
import { useAuth } from '@/hooks/useAuth';

// Constants
const LOGO_CONFIG = {
  src: "/lovable-uploads/4d93c5dd-bdd8-4951-8fbb-4996db07b7c5.png",
  alt: "NotaVoice",
  className: "h-8 w-auto"
} as const;

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help", label: "Help" }
] as const;

const NAV_LINK_STYLES = {
  base: "transition-colors hover:text-foreground/80",
  active: "text-foreground",
  inactive: "text-foreground/60"
} as const;

// Types
interface NavigationLink {
  href: string;
  label: string;
}

// Safe auth hook for public routes
const useSafeAuth = () => {
  try {
    return useAuth();
  } catch (error) {
    return {
      user: null,
      isPremium: false,
      isAdmin: false,
      signOut: async () => {}
    };
  }
};

// Logo component to eliminate duplication
const Logo = ({ className = "", hiddenOnSm = false }: { className?: string; hiddenOnSm?: boolean }) => (
  <img 
    src={LOGO_CONFIG.src}
    alt={LOGO_CONFIG.alt}
    className={`${LOGO_CONFIG.className} ${hiddenOnSm ? 'hidden sm:inline-block' : ''} ${className}`}
  />
);

// Navigation link with consistent styling
const NavLink = ({ 
  link, 
  currentPath, 
  onClick, 
  className = "" 
}: { 
  link: NavigationLink; 
  currentPath: string; 
  onClick?: () => void;
  className?: string;
}) => {
  const isActive = currentPath === link.href;
  const linkClasses = `${NAV_LINK_STYLES.base} ${isActive ? NAV_LINK_STYLES.active : NAV_LINK_STYLES.inactive} ${className}`;
  
  return (
    <SimpleNavigationLink
      key={link.href}
      to={link.href}
      onClick={onClick}
      className={linkClasses}
    >
      {link.label}
    </SimpleNavigationLink>
  );
};

const Header = () => {
  const { user, isPremium, isAdmin, signOut } = useSafeAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new CustomEvent('navigate', { detail: { path } }));
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleNavItemClick = (path: string) => {
    setIsMobileMenuOpen(false);
    navigate(path);
  };

  const userMenuItems = useMemo(() => [
    { label: "Dashboard", path: "/app", icon: Settings },
    { label: "Profile", path: "/profile", icon: User },
    ...(isAdmin ? [{ label: "Admin", path: "/admin", icon: Settings }] : [])
  ], [isAdmin]);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-14 items-center">
        {/* Desktop Navigation */}
        <div className="mr-4 hidden md:flex">
          <SimpleNavigationLink to="/" className="mr-6 flex items-center space-x-2">
            <Logo hiddenOnSm />
          </SimpleNavigationLink>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} link={link} currentPath={currentPath} />
            ))}
          </nav>
        </div>

        {/* Mobile Menu */}
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
              <Logo />
            </SimpleNavigationLink>
            <div className="my-4 h-[calc(100vh-8rem)] pb-10 pl-6">
              <div className="flex flex-col space-y-3">
                {NAV_LINKS.map((link) => (
                  <NavLink 
                    key={link.href}
                    link={link} 
                    currentPath={currentPath} 
                    onClick={() => handleNavItemClick(link.href)}
                  />
                ))}
                <Separator />
                {user ? (
                  <div className="flex flex-col space-y-3">
                    {userMenuItems.map((item) => (
                      <SimpleNavigationLink
                        key={item.path}
                        to={item.path}
                        onClick={() => handleNavItemClick(item.path)}
                        className={NAV_LINK_STYLES.base + " " + NAV_LINK_STYLES.inactive}
                      >
                        {item.label}
                      </SimpleNavigationLink>
                    ))}
                    <button
                      onClick={handleSignOut}
                      className={`text-left ${NAV_LINK_STYLES.base} ${NAV_LINK_STYLES.inactive}`}
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-3">
                    <SimpleNavigationLink
                      to="/signin"
                      onClick={() => handleNavItemClick('/signin')}
                      className={`${NAV_LINK_STYLES.base} ${NAV_LINK_STYLES.inactive}`}
                    >
                      Sign In
                    </SimpleNavigationLink>
                    <SimpleNavigationLink
                      to="/signup"
                      onClick={() => handleNavItemClick('/signup')}
                      className={`${NAV_LINK_STYLES.base} ${NAV_LINK_STYLES.inactive}`}
                    >
                      Sign Up
                    </SimpleNavigationLink>
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Right Side */}
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <SimpleNavigationLink to="/" className="flex items-center space-x-2 md:hidden">
              <Logo />
            </SimpleNavigationLink>
          </div>
          <nav className="flex items-center space-x-2">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{user.email}</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {isPremium ? 'Premium User' : 'Free User'}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {userMenuItems.map((item) => (
                    <DropdownMenuItem key={item.path} onClick={() => navigate(item.path)}>
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.label}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:flex items-center space-x-2">
                <Button variant="ghost" onClick={() => navigate('/signin')}>
                  Sign In
                </Button>
                <Button variant="hero" onClick={() => navigate('/signup')}>
                  Start Free
                </Button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;