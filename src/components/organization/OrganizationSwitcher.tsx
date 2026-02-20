import * as React from "react";
import { ChevronDown, Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';

export const OrganizationSwitcher: React.FC = () => {
  const { user } = useAuth();
  const { 
    organizations, 
    currentOrganization, 
    switchOrganization, 
    loading 
  } = useOrganization();

  if (!user || loading) {
    return null;
  }

  if (organizations.length === 0) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        className="w-full justify-start"
        onClick={() => {
          // TODO: Navigate to organization creation
          console.log('Create organization');
        }}
      >
        <Building2 className="w-4 h-4 mr-2" />
        Create Organization
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full justify-between"
          disabled={loading}
        >
          <div className="flex items-center">
            <Building2 className="w-4 h-4 mr-2" />
            <span className="truncate">
              {currentOrganization?.name || 'Select Organization'}
            </span>
          </div>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => switchOrganization(org.id)}
            className={`cursor-pointer ${
              currentOrganization?.id === org.id ? 'bg-accent' : ''
            }`}
          >
            <Building2 className="w-4 h-4 mr-2" />
            <div className="flex flex-col">
              <span className="font-medium">{org.name}</span>
              {org.description && (
                <span className="text-xs text-muted-foreground truncate">
                  {org.description}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            // TODO: Navigate to organization creation
            console.log('Create new organization');
          }}
          className="cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};