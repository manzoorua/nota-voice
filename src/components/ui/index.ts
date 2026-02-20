// Unified component exports - consolidating simple and standard variants
// This file provides a single source of truth for UI components

// Primary components (removing redundant simple variants)
export { Button } from './button';
export { Input } from './input';
export { Label } from './label';
export { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './card';
export { Badge } from './badge';
export { Avatar, AvatarFallback, AvatarImage } from './avatar';
export { Separator } from './separator';
export { Progress } from './progress';
export { Switch } from './switch';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
export { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from './dialog';
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
export { Textarea } from './textarea';
export { Checkbox } from './checkbox';
export { RadioGroup, RadioGroupItem } from './radio-group';
export { Slider } from './slider';
export { Toggle } from './toggle';
export { ToggleGroup, ToggleGroupItem } from './toggle-group';
export { Popover, PopoverContent, PopoverTrigger } from './popover';
export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuRadioItem } from './dropdown-menu';
export { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './sheet';
export { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './alert-dialog';
export { Alert, AlertDescription, AlertTitle } from './alert';
export { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion';
export { AspectRatio } from './aspect-ratio';
export { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
export { ScrollArea, ScrollBar } from './scroll-area';
export { Skeleton } from './skeleton';
export { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './table';
export { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger } from './menubar';
export { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuList, NavigationMenuTrigger, NavigationMenuIndicator, NavigationMenuViewport } from './navigation-menu';
export { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from './command';

export { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from './form';

// Specialized components (default exports)
export { default as VoiceRecorder } from './VoiceRecorder';
export { default as AudioFileUpload } from './AudioFileUpload';
export { default as MobileVoiceRecorder } from './MobileVoiceRecorder';

// Performance-optimized simple variants (keeping only essential ones)
import { toast } from "sonner"
