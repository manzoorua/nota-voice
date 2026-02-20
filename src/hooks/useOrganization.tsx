import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatar_url?: string;
  website_url?: string;
  industry?: string;
  company_size?: string;
  subscription_status?: string;
  subscription_tier?: string;
  created_at: string;
  updated_at: string;
}

interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'org_admin' | 'org_manager' | 'org_member' | 'org_viewer';
  invited_by?: string;
  joined_at: string;
  is_active: boolean;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  organizationMemberships: OrganizationMember[];
  loading: boolean;
  error: string | null;
  switchOrganization: (organizationId: string) => void;
  refreshOrganizations: () => Promise<void>;
  hasOrganizationRole: (role: string, organizationId?: string) => boolean;
  isOrganizationAdmin: (organizationId?: string) => boolean;
  isOrganizationManager: (organizationId?: string) => boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};

interface OrganizationProviderProps {
  children: ReactNode;
}

export const OrganizationProvider: React.FC<OrganizationProviderProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizationMemberships, setOrganizationMemberships] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Fetch organizations from database
  const fetchOrganizations = React.useCallback(async () => {
    if (!user || authLoading) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Fetch user's organizations
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select(`
          *,
          organization_members!inner(
            id,
            organization_id,
            user_id,
            role,
            invited_by,
            joined_at,
            is_active
          )
        `)
        .eq('organization_members.user_id', user.id)
        .eq('organization_members.is_active', true);

      if (orgError) {
        throw orgError;
      }

      // Transform data to separate organizations and memberships
      const organizations: Organization[] = [];
      const memberships: OrganizationMember[] = [];

      orgData?.forEach(org => {
        organizations.push({
          id: org.id,
          name: org.name,
          slug: org.slug,
          description: org.description,
          avatar_url: org.avatar_url,
          website_url: org.website_url,
          industry: org.industry,
          company_size: org.company_size,
          subscription_status: org.subscription_status,
          subscription_tier: org.subscription_tier,
          created_at: org.created_at,
          updated_at: org.updated_at,
        });

        if (org.organization_members?.length > 0) {
          memberships.push(org.organization_members[0]);
        }
      });

      setOrganizations(organizations);
      setOrganizationMemberships(memberships);

      // Set current organization to first admin org, or first org
      const adminOrg = organizations.find(org => {
        const membership = memberships.find(m => m.organization_id === org.id);
        return membership?.role === 'org_admin';
      });
      
      setCurrentOrganization(adminOrg || organizations[0] || null);

    } catch (err) {
      console.error('Error fetching organizations:', err);
      setError('Failed to load organizations');
      setOrganizations([]);
      setOrganizationMemberships([]);
      setCurrentOrganization(null);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [user, authLoading]);

  // Initialize organization data when auth is ready
  useEffect(() => {
    if (!authLoading && !initialized) {
      if (user) {
        fetchOrganizations();
      } else {
        // Clear state if no user
        setOrganizations([]);
        setCurrentOrganization(null);
        setOrganizationMemberships([]);
        setLoading(false);
        setInitialized(true);
      }
    }
  }, [user, authLoading, initialized, fetchOrganizations]);

  const switchOrganization = React.useCallback((organizationId: string) => {
    const org = organizations.find(o => o.id === organizationId);
    if (org) {
      setCurrentOrganization(org);
    }
  }, [organizations]);

  const refreshOrganizations = React.useCallback(async () => {
    setInitialized(false);
    await fetchOrganizations();
  }, [fetchOrganizations]);

  const hasOrganizationRole = React.useCallback((role: string, organizationId?: string) => {
    const targetOrgId = organizationId || currentOrganization?.id;
    if (!targetOrgId) return false;

    const membership = organizationMemberships.find(
      m => m.organization_id === targetOrgId && m.is_active
    );
    
    return membership?.role === role;
  }, [organizationMemberships, currentOrganization]);

  const isOrganizationAdmin = React.useCallback((organizationId?: string) => {
    return hasOrganizationRole('org_admin', organizationId);
  }, [hasOrganizationRole]);

  const isOrganizationManager = React.useCallback((organizationId?: string) => {
    return hasOrganizationRole('org_manager', organizationId) || 
           hasOrganizationRole('org_admin', organizationId);
  }, [hasOrganizationRole]);

  const value = React.useMemo(() => ({
    organizations,
    currentOrganization,
    organizationMemberships,
    loading: loading || authLoading,
    error,
    switchOrganization,
    refreshOrganizations,
    hasOrganizationRole,
    isOrganizationAdmin,
    isOrganizationManager,
  }), [
    organizations,
    currentOrganization,
    organizationMemberships,
    loading,
    authLoading,
    error,
    switchOrganization,
    refreshOrganizations,
    hasOrganizationRole,
    isOrganizationAdmin,
    isOrganizationManager,
  ]);

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
};