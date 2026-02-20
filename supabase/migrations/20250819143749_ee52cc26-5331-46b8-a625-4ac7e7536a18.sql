-- Phase 1: Add organization_id to core tables for multi-tenancy
-- This migration adds organization context to the most critical user-scoped tables

-- Add organization_id to voice_notes table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voice_notes' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE voice_notes ADD COLUMN organization_id UUID REFERENCES organizations(id);
        
        -- Update existing voice_notes to use user's default organization
        UPDATE voice_notes 
        SET organization_id = (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = voice_notes.user_id 
            AND om.role = 'org_admin' 
            LIMIT 1
        )
        WHERE organization_id IS NULL;
    END IF;
END $$;

-- Add organization_id to conversations table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE conversations ADD COLUMN organization_id UUID REFERENCES organizations(id);
        
        -- Update existing conversations
        UPDATE conversations 
        SET organization_id = (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = conversations.user_id 
            AND om.role = 'org_admin' 
            LIMIT 1
        )
        WHERE organization_id IS NULL;
    END IF;
END $$;

-- Update RLS policies for voice_notes to use organization-based isolation
DROP POLICY IF EXISTS "Users can create own voice notes" ON voice_notes;
DROP POLICY IF EXISTS "Users can view own voice notes" ON voice_notes;
DROP POLICY IF EXISTS "Users can update own voice notes" ON voice_notes;
DROP POLICY IF EXISTS "Users can delete own voice notes" ON voice_notes;

-- Create organization-based policies for voice_notes
CREATE POLICY "Organization members can view voice notes"
ON voice_notes FOR SELECT
USING (
    organization_id IS NOT NULL 
    AND is_organization_member(auth.uid(), organization_id)
);

CREATE POLICY "Organization members can create voice notes"
ON voice_notes FOR INSERT
WITH CHECK (
    organization_id IS NOT NULL 
    AND is_organization_member(auth.uid(), organization_id)
);

CREATE POLICY "Organization members can update voice notes"
ON voice_notes FOR UPDATE
USING (
    organization_id IS NOT NULL 
    AND is_organization_member(auth.uid(), organization_id)
);

CREATE POLICY "Organization members can delete voice notes"
ON voice_notes FOR DELETE
USING (
    organization_id IS NOT NULL 
    AND is_organization_member(auth.uid(), organization_id)
);

-- Update RLS policies for conversations
DROP POLICY IF EXISTS "Users can create own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;

CREATE POLICY "Organization members can view conversations"
ON conversations FOR SELECT
USING (
    organization_id IS NOT NULL 
    AND is_organization_member(auth.uid(), organization_id)
);

CREATE POLICY "Organization members can create conversations"
ON conversations FOR INSERT
WITH CHECK (
    organization_id IS NOT NULL 
    AND is_organization_member(auth.uid(), organization_id)
);

CREATE POLICY "Organization members can update conversations"
ON conversations FOR UPDATE
USING (
    organization_id IS NOT NULL 
    AND is_organization_member(auth.uid(), organization_id)
);

CREATE POLICY "Organization members can delete conversations"
ON conversations FOR DELETE
USING (
    organization_id IS NOT NULL 
    AND is_organization_member(auth.uid(), organization_id)
);

-- Create helper function to get user's current organization
CREATE OR REPLACE FUNCTION get_user_current_organization(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = _user_id 
  AND om.is_active = true
  ORDER BY 
    CASE om.role 
      WHEN 'org_admin' THEN 1
      WHEN 'org_manager' THEN 2
      ELSE 3
    END,
    om.joined_at ASC
  LIMIT 1;
$$;