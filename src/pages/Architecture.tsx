import * as React from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, BookOpen } from "lucide-react";
import { functionLogsUrl, dashboardLinks, SUPABASE_PROJECT_ID, SUPABASE_PROJECT_URL } from "@/utils/supabaseInfo";
import { measureEdgeFunction, type EdgeFunctionCheckResult } from "@/utils/observability";

import archOverview from "@/assets/architecture/architecture-overview.jpg";
import edgeFunctions from "@/assets/architecture/edge-functions.jpg";

const Architecture: React.FC = () => {
  const [checksLoading, setChecksLoading] = React.useState(false);
  const [checkResults, setCheckResults] = React.useState<EdgeFunctionCheckResult[]>([]);

  React.useEffect(() => {
    const title = "Architecture & Diagnostics — Admin";
    const description = "Architecture overview, edge function checks, and diagnostics for admins.";
    document.title = title;

    const setMeta = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    setMeta("description", description);

    // Canonical
    const canonicalHref = `${window.location.origin}/architecture`;
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalHref);
  }, []);

  const runConnectivityChecks = async () => {
    setChecksLoading(true);
    setCheckResults([]);
    const results: EdgeFunctionCheckResult[] = [];
    results.push(await measureEdgeFunction("transcribe-audio", { ping: true }));
    results.push(await measureEdgeFunction("enhance-text", { text: "hello world", style: "clean" }));
    setCheckResults(results);
    setChecksLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <section className="container px-4 py-12">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Architecture & Diagnostics</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Explore the system architecture, run edge function connectivity checks, and access quick diagnostics.
            </p>
          </header>

          {/* Architecture Overview */}
          <article className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Architecture Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={archOverview}
                  alt="Architecture overview diagram: Browser to Supabase Edge Functions to Database (voice_notes)"
                  loading="lazy"
                  className="w-full h-auto rounded-md"
                />
                <div className="text-sm text-muted-foreground mt-3">
                  <p>Browser records audio → Edge Functions transcribe/enhance → voice_notes updated.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Edge Functions Flow</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={edgeFunctions}
                  alt="Edge functions flow diagram: transcribe-audio and enhance-text with logs"
                  loading="lazy"
                  className="w-full h-auto rounded-md"
                />
                <div className="text-sm text-muted-foreground mt-3">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>transcribe-audio → Whisper/OpenAI → updates transcription</li>
                    <li>enhance-text → GPT → refines title/content</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </article>

          {/* Observability */}
          <section className="mt-10">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Observability</CardTitle>
                <Button variant="outline" size="sm" onClick={runConnectivityChecks} disabled={checksLoading}>
                  {checksLoading ? "Running checks..." : "Run connectivity checks"}
                </Button>
              </CardHeader>
              <CardContent>
                {checkResults.length === 0 && !checksLoading && (
                  <p className="text-sm text-muted-foreground">No results yet. Click "Run connectivity checks".</p>
                )}
                <div className="mt-2 space-y-2">
                  {checkResults.map((r) => (
                    <div key={r.name} className="flex items-center justify-between rounded-md border p-3 bg-card">
                      <div className="flex items-center gap-2">
                        {r.ok ? (
                          <Wifi className="w-4 h-4 text-success" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-destructive" />
                        )}
                        <span className="font-medium">{r.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{r.ms} ms</span>
                        {r.error && (
                          <span className="text-xs text-muted-foreground max-w-[280px] truncate">Note: {r.error}</span>
                        )}
                        <a
                          className="text-primary underline text-xs"
                          href={functionLogsUrl(r.name)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View logs
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Diagnostics */}
          <section className="mt-10">
            <Card>
              <CardHeader>
                <CardTitle>Diagnostics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border p-3 bg-background">
                  <p className="font-medium mb-2">Supabase configuration</p>
                  <div className="grid gap-1 text-sm">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-40">Project ID</span>
                      <span className="font-mono">{SUPABASE_PROJECT_ID}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-40">Project URL</span>
                      <a href={SUPABASE_PROJECT_URL} target="_blank" rel="noreferrer" className="text-primary underline">
                        {SUPABASE_PROJECT_URL}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border p-3 bg-background mt-4">
                  <p className="font-medium mb-2">Admin checklist</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    <li>
                      Verify Auth redirect URLs: {" "}
                      <a className="text-primary underline" href={dashboardLinks.authProviders} target="_blank" rel="noreferrer">
                        Auth providers
                      </a>
                    </li>
                    <li>
                      Check Edge Function logs: {" "}
                      <a className="text-primary underline" href={dashboardLinks.edgeFunctions} target="_blank" rel="noreferrer">
                        Functions dashboard
                      </a>
                    </li>
                    <li>
                      API key distribution (OPENAI_API_KEY as Edge Function secret): {" "}
                      <a className="text-primary underline" href={dashboardLinks.functionsSecrets} target="_blank" rel="noreferrer">
                        Functions secrets
                      </a>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Architecture;
