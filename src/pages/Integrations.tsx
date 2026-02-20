import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WebhookManager from '@/components/integrations/WebhookManager';
import IntegrationManager from '@/components/integrations/IntegrationManager';
import WebhookLogs from '@/components/integrations/WebhookLogs';

const IntegrationsPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Integrations & Webhooks</h1>
        <p className="text-muted-foreground">
          Connect NotaVoice with external services and automation tools to streamline your workflow
        </p>
      </div>

      <Tabs defaultValue="webhooks" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="webhooks">
          <WebhookManager />
        </TabsContent>
        
        <TabsContent value="integrations">
          <IntegrationManager />
        </TabsContent>
        
        <TabsContent value="logs">
          <WebhookLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegrationsPage;