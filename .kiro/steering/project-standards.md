# Project Standards and Guidelines

## Project Overview

This is a modern React application built with:
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom animations
- **Backend**: Supabase for database and authentication
- **State Management**: TanStack Query for server state
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite with SWC for fast compilation

## Code Standards

### TypeScript Guidelines
- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use proper typing for all function parameters and return values
- Leverage Zod schemas for runtime validation and type inference
- Avoid `any` type - use `unknown` when type is truly unknown

### React Best Practices
- Use functional components with hooks
- Implement proper error boundaries
- Use React.memo() for performance optimization when needed
- Follow the hooks rules (only call at top level)
- Use custom hooks for reusable logic
- Prefer composition over inheritance

### Component Structure
```typescript
// Component file structure
import React from 'react';
import { ComponentProps } from './types';
import { cn } from '@/lib/utils';

interface Props extends ComponentProps {
  // Component-specific props
}

export const ComponentName = ({ prop1, prop2, ...props }: Props) => {
  // Component logic
  
  return (
    <div className={cn("base-classes", props.className)}>
      {/* Component JSX */}
    </div>
  );
};
```

### File Organization
- Components in `/src/components/` with index exports
- Pages in `/src/pages/`
- Hooks in `/src/hooks/`
- Utilities in `/src/utils/`
- Types in `/src/types/` or co-located with components
- API integrations in `/src/integrations/`

### Styling Guidelines
- Use Tailwind CSS utility classes
- Leverage shadcn/ui components for consistent design
- Use `cn()` utility for conditional classes
- Follow mobile-first responsive design
- Use CSS variables for theme customization
- Prefer Tailwind utilities over custom CSS

### State Management
- Use TanStack Query for server state management
- Use React's built-in state (useState, useReducer) for local state
- Implement proper loading and error states
- Use optimistic updates where appropriate
- Cache data effectively with proper invalidation

### Form Handling
- Use React Hook Form for form management
- Implement Zod schemas for validation
- Use shadcn/ui form components
- Provide clear error messages and validation feedback
- Handle form submission states properly

### Database and API
- Use Supabase client for database operations
- Implement proper error handling for API calls
- Use TypeScript types generated from Supabase schema
- Follow RESTful principles for API design
- Implement proper authentication and authorization

## Development Workflow

### Testing Strategy
- Write unit tests for utility functions
- Test components with React Testing Library
- Use MSW for API mocking in tests
- Implement integration tests for critical user flows
- Maintain good test coverage for business logic

### Performance Guidelines
- Use React.lazy() for code splitting
- Implement proper image optimization
- Use TanStack Query for efficient data fetching
- Minimize bundle size with tree shaking
- Use proper caching strategies

### Accessibility Standards
- Use semantic HTML elements
- Implement proper ARIA attributes
- Ensure keyboard navigation works
- Maintain proper color contrast ratios
- Test with screen readers
- Use shadcn/ui components which have built-in accessibility

### Error Handling
- Implement global error boundaries
- Use proper error states in components
- Log errors appropriately
- Provide user-friendly error messages
- Handle network failures gracefully

## Code Quality

### ESLint Configuration
- Follow the existing ESLint configuration
- Use TypeScript ESLint rules
- Implement React-specific linting rules
- Ensure consistent code formatting

### Git Workflow
- Use conventional commit messages
- Create feature branches for new development
- Write descriptive commit messages
- Keep commits atomic and focused

### Documentation
- Document complex business logic
- Use JSDoc for function documentation
- Maintain up-to-date README files
- Document API endpoints and data models

## Security Best Practices
- Validate all user inputs
- Use environment variables for sensitive data
- Implement proper authentication flows
- Follow OWASP security guidelines
- Keep dependencies updated
- Use Supabase RLS (Row Level Security) policies

## Deployment and Environment
- Use environment variables for configuration
- Implement proper build optimization
- Use Vite's build tools for production builds
- Follow Lovable deployment guidelines
- Monitor application performance and errors