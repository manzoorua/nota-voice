# Component Patterns and Architecture

## shadcn/ui Integration

### Component Usage
- Always use shadcn/ui components as the foundation
- Extend components using the `cn()` utility for additional styling
- Follow the shadcn/ui component API patterns
- Use Radix UI primitives for complex interactions

### Custom Component Creation
```typescript
// Example: Extending a shadcn/ui component
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CustomButtonProps extends React.ComponentProps<typeof Button> {
  loading?: boolean;
}

export const CustomButton = ({ loading, children, className, ...props }: CustomButtonProps) => {
  return (
    <Button 
      className={cn("relative", className)} 
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Spinner className="mr-2 h-4 w-4" />}
      {children}
    </Button>
  );
};
```

## Form Patterns

### Standard Form Implementation
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof formSchema>;

export const LoginForm = () => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    // Handle form submission
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </Form>
  );
};
```

## Data Fetching Patterns

### TanStack Query Implementation
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Query hook
export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*');
      
      if (error) throw error;
      return data;
    },
  });
};

// Mutation hook
export const useCreateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userData: CreateUserData) => {
      const { data, error } = await supabase
        .from('users')
        .insert(userData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};
```

## Layout Patterns

### Page Layout Structure
```typescript
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Footer } from '@/components/layout/Footer';

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
};
```

## Error Handling Patterns

### Error Boundary Implementation
```typescript
import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            {this.state.error?.message || 'An unexpected error occurred'}
          </AlertDescription>
          <Button 
            variant="outline" 
            onClick={() => this.setState({ hasError: false })}
            className="mt-2"
          >
            Try again
          </Button>
        </Alert>
      );
    }

    return this.props.children;
  }
}
```

## Loading States

### Consistent Loading Patterns
```typescript
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

// For data loading
export const UserListSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[150px]" />
        </div>
      </div>
    ))}
  </div>
);

// For button loading states
<Button disabled={isLoading}>
  {isLoading && <Spinner className="mr-2 h-4 w-4" />}
  {isLoading ? 'Loading...' : 'Submit'}
</Button>
```

## Responsive Design Patterns

### Mobile-First Approach
```typescript
// Use Tailwind's responsive prefixes
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Content */}
</div>

// Responsive text sizing
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
  Responsive Heading
</h1>

// Responsive spacing
<div className="p-4 md:p-6 lg:p-8">
  {/* Content */}
</div>
```

## Accessibility Patterns

### Keyboard Navigation
```typescript
const handleKeyDown = (event: React.KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onClick();
  }
};

<div
  role="button"
  tabIndex={0}
  onKeyDown={handleKeyDown}
  onClick={onClick}
  className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
>
  Clickable content
</div>
```

### ARIA Labels and Descriptions
```typescript
<Button
  aria-label="Delete user"
  aria-describedby="delete-description"
>
  <TrashIcon />
</Button>
<div id="delete-description" className="sr-only">
  This action cannot be undone
</div>
```