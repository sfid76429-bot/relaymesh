import { type FormEvent, type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowRight, Check, ChevronDown, Clipboard, Code2, Copy, ExternalLink, KeyRound, Loader2, LockKeyhole, Menu, MessageSquareText, Network, RefreshCw, Send, ShieldCheck, Sparkles, Activity, X } from 'lucide-react';
import { Link, Route, Switch } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  getGetRelayStatsQueryKey,
  getListRelayProvidersQueryKey,
  useAddRelayKey,
  useGetRelayStats,
  useListRelayProviders,
  useRelayChatCompletion,
} from '@workspace/api-client-react';
import type { RelayProvider } from '@workspace/api-client-react';

const queryClient = new QueryClient();

const fallbackProviders: RelayProvider[] = [
  { id: 'openrouter-free', name: 'OpenRouter free', shortName: 'OR', kind: 'OpenAI-compatible', model: 'openrouter/free', endpoint: 'openrouter.ai/api/v1', keyCount: 0, status: 'waiting for keys', accent: '#e4a15b' },
  { id: 'gemini-free', name: 'Gemini free tier', shortName: 'GE', kind: 'Google Generative Language', model: 'gemini-2.0-flash', endpoint: 'generativelanguage.googleapis.com', keyCount: 0, status: 'waiting for keys', accent: '#55a8a0' },
  { id: 'g4f-community', name: 'G4F community adapter', shortName: 'G4', kind: 'Community adapter', model: 'community-auto', endpoint: 'community adapter', keyCount: 0, status: 'adapter soon', accent: '#ef8f75' },
  { id: 'pollinations-free', name: 'Pollinations public fallback', shortName: 'PO', kind: 'No-key public fallback', model: 'openai', endpoint: 'text.pollinations.ai/openai', keyCount: 0, status: 'public fallback', accent: '#719b72' },
];

function formatNumber(value: number | undefined) {
  return value === undefined ? '—' : new Intl.NumberFormat('en-US').format(value);
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('degrad') || normalized.includes('limited')) return 'degraded';
  if (normalized.includes('down') || normalized.includes('offline')) return 'offline';
  return 'healthy';
}

function Shell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="grain min-h-[100dvh] overflow-x-hidden bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="container-wide flex h-[72px] items-center justify-between">
          <Link href="/" className="group flex items-center gap-3" data-testid="link-home">
            <span className="relative grid size-9 place-items-center rounded-[11px] bg-primary text-primary-foreground shadow-[0_7px_18px_hsl(var(--primary)/.22)]">
              <Network size={18} strokeWidth={2.4} />
              <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-accent ring-2 ring-background" />
            </span>
            <span className="text-[15px] font-bold tracking-[-.02em]">RelayMesh</span>
          </Link>
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-muted-foreground md:flex" aria-label="Main navigation">
            <a href="#health" data-testid="link-health" className="transition-colors hover:text-foreground">Provider health</a>
            <a href="#playground" data-testid="link-playground" className="transition-colors hover:text-foreground">Playground</a>
            <a href="#contribute" data-testid="link-contribute" className="transition-colors hover:text-foreground">Contribute a key</a>
            <a href="#how-it-works" data-testid="link-how-it-works" className="transition-colors hover:text-foreground">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            <a href="#endpoint" data-testid="link-endpoint-top" className="hidden items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[12px] font-semibold transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm sm:flex">
              <Code2 size={14} /> Get endpoint
            </a>
            <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="grid size-9 place-items-center rounded-lg border border-border bg-card md:hidden" aria-label="Toggle navigation" data-testid="button-toggle-menu">
              {menuOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="container-wide flex flex-col gap-1 border-t border-border/70 py-3 text-sm md:hidden" aria-label="Mobile navigation">
            <a href="#health" onClick={() => setMenuOpen(false)} data-testid="mobile-link-health" className="rounded-lg px-3 py-2.5 hover:bg-muted">Provider health</a>
            <a href="#playground" onClick={() => setMenuOpen(false)} data-testid="mobile-link-playground" className="rounded-lg px-3 py-2.5 hover:bg-muted">Playground</a>
            <a href="#contribute" onClick={() => setMenuOpen(false)} data-testid="mobile-link-contribute" className="rounded-lg px-3 py-2.5 hover:bg-muted">Contribute a key</a>
            <a href="#how-it-works" onClick={() => setMenuOpen(false)} data-testid="mobile-link-how-it-works" className="rounded-lg px-3 py-2.5 hover:bg-muted">How it works</a>
          </nav>
        )}
      </header>
      {children}
      <footer className="border-t border-border bg-[hsl(var(--secondary)/.35)]">
        <div className="container-wide flex flex-col justify-between gap-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground"><Network size={14} /></span>
            <span>RelayMesh <span className="text-muted-foreground/60">/ community AI infrastructure</span></span>
          </div>
          <div className="flex gap-5 text-xs">
            <a href="#how-it-works" data-testid="footer-link-transparency" className="hover:text-foreground">Transparency</a>
            <a href="#contribute" data-testid="footer-link-contribute" className="hover:text-foreground">Contribute</a>
            <a href="#endpoint" data-testid="footer-link-api" className="hover:text-foreground">API access</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatStrip() {
  const statsQuery = useGetRelayStats({ query: { queryKey: getGetRelayStatsQueryKey(), refetchInterval: 45000 } });
  const stats = statsQuery.data;
  return (
    <section className="border-y border-border/80 bg-card/70" aria-label="Relay statistics">
      <div className="container-wide grid grid-cols-2 divide-x divide-y divide-border/70 sm:grid-cols-4 sm:divide-y-0">
        {[
          ['providers', stats?.providers, 'providers online'],
          ['active-keys', stats?.activeKeys, 'active community keys'],
          ['requests', stats?.requestsRouted, 'requests routed'],
          ['uptime', stats?.uptimePercent, 'rolling uptime', true],
        ].map(([id, value, label, percent]) => (
          <div key={id as string} className="px-4 py-5 first:pl-0 sm:px-6 sm:py-6">
            <div className="mono min-h-8 text-[22px] font-bold tracking-[-.05em] text-foreground">
              {statsQuery.isLoading ? <span className="inline-block h-7 w-16 animate-pulse rounded bg-muted" /> : value === undefined ? '—' : `${value}${percent ? '%' : ''}`}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[.12em] text-muted-foreground">{label as string}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProviderHealth() {
  const providersQuery = useListRelayProviders({ query: { queryKey: getListRelayProvidersQueryKey(), refetchInterval: 30000 } });
  const providers = providersQuery.data ?? (providersQuery.isError ? fallbackProviders : []);
  return (
    <section id="health" className="container-wide scroll-mt-24 py-20 md:py-28">
      <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-primary"><Activity size={14} /> Live routing pool</div>
          <h2 className="max-w-xl text-3xl font-bold tracking-[-.045em] md:text-[42px] md:leading-[1.08]">A clear view of the path your request takes.</h2>
          <p className="mt-4 max-w-lg text-[15px] leading-7 text-muted-foreground">Every provider is checked continuously. When one reaches a limit, the relay steps around it instead of making you debug someone else’s quota.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-50" /><span className="relative inline-flex size-2 rounded-full bg-primary" /></span>
          Refreshes every 30 seconds
        </div>
      </div>
      {providersQuery.isError && <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm"><span>Live health is temporarily unavailable. Showing the last known pool shape.</span><button type="button" onClick={() => providersQuery.refetch()} data-testid="button-retry-providers" className="inline-flex items-center gap-1.5 font-semibold text-primary"><RefreshCw size={14} /> Retry</button></div>}
      {providersQuery.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl border border-border bg-muted" />)}</div>
      ) : providers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center"><Network className="mx-auto mb-3 text-muted-foreground" /><p className="font-semibold">The routing pool is waking up.</p><p className="mt-1 text-sm text-muted-foreground">Provider health will appear as soon as the relay checks in.</p></div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {providers.map((provider) => {
            const tone = statusTone(provider.status);
            return (
              <article key={provider.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]" data-testid={`card-provider-${provider.id}`}>
                <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: provider.accent || 'hsl(var(--primary))' }} />
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl text-xs font-bold" style={{ backgroundColor: `${provider.accent || '#55a8a0'}22`, color: provider.accent || '#267c75' }}>{provider.shortName}</span>
                    <div><h3 className="font-bold tracking-[-.02em]">{provider.name}</h3><p className="mt-0.5 text-xs text-muted-foreground">{provider.kind}</p></div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${tone === 'healthy' ? 'bg-primary/10 text-primary' : tone === 'degraded' ? 'bg-accent/15 text-[#b45c42]' : 'bg-destructive/10 text-destructive'}`} data-testid={`status-provider-${provider.id}`}>
                    <span className={`size-1.5 rounded-full ${tone === 'healthy' ? 'bg-primary' : tone === 'degraded' ? 'bg-accent' : 'bg-destructive'}`} />{provider.status}
                  </span>
                </div>
                <div className="mt-7 flex items-end justify-between border-t border-border/70 pt-4">
                  <div><div className="mono text-xs text-muted-foreground">{provider.model}</div><div className="mt-1 text-xs text-muted-foreground">{provider.keyCount} {provider.keyCount === 1 ? 'contributor key' : 'contributor keys'}</div></div>
                  <ArrowDownRight size={18} className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:translate-y-1" />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

const playgroundContext = `You are the helpful RelayMesh website assistant. Answer questions about this website clearly and honestly.

RelayMesh is a no-login community AI relay that gives developers one OpenAI-compatible chat endpoint while routing requests across available AI capacity. Contributors can explicitly share OpenRouter or Gemini provider keys; the relay stores those keys encrypted, only shows masked versions, and uses health checks, least-recently-used rotation, rate-limit handling, and cooldowns to avoid unhealthy routes. If contributor-backed routes are unavailable, the relay automatically tries a labeled no-key public fallback. The public playground does not require the visitor to provide a key.

The compatible endpoint is /api/v1/chat/completions. It accepts the familiar messages, model, and temperature fields and returns a standard choices[] chat completion response, plus routing metadata such as the provider and fallback count. G4F is visible in the provider catalog but currently marked adapter soon because it is not enabled as a verified route yet. The relay is intended to make free community capacity easier to use without changing an existing OpenAI-compatible client.

Explain RelayMesh in simple language, answer practical questions about routing, shared keys, fallbacks, privacy, and the endpoint, and do not invent capabilities or promise guarantees that are not described here.`;

function Playground() {
  const chat = useRelayChatCompletion();
  const [prompt, setPrompt] = useState('Give me a one-sentence explanation of what a shared AI relay does.');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState('0.4');
  const response = chat.data;
  const suggestedPrompts = [
    'What does RelayMesh do?',
    'How are shared keys protected?',
    'What happens when a provider is unavailable?',
  ];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || chat.isPending) return;
    chat.mutate({ data: { messages: [{ role: 'system', content: playgroundContext }, { role: 'user', content: prompt.trim() }], ...(model ? { model } : {}), temperature: Number(temperature) } });
  };
  return (
    <section id="playground" className="surface-grid scroll-mt-24 border-y border-border/70 bg-[hsl(var(--secondary)/.3)] py-20 md:py-28">
      <div className="container-wide">
        <div className="mb-9 max-w-2xl"><div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-primary"><MessageSquareText size={14} /> Quick playground</div><h2 className="text-3xl font-bold tracking-[-.045em] md:text-[42px] md:leading-[1.08]">Try the relay before you wire it in.</h2><p className="mt-4 text-[15px] leading-7 text-muted-foreground">Ask the assistant what the relay does, how shared keys are protected, or what happens when a provider reaches its limit. No account or key needed for this shared demo.</p></div>
        <div className="grid min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-md)] lg:grid-cols-[.9fr_1.1fr]">
          <form onSubmit={submit} className="min-w-0 border-b border-border p-5 sm:p-7 lg:border-b-0 lg:border-r" data-testid="form-playground">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><span className="mono min-w-0 text-[11px] uppercase tracking-[.12em] text-muted-foreground">POST /v1/chat/completions</span><span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">OpenAI-compatible</span></div>
            <label className="block text-sm font-semibold" htmlFor="playground-prompt">Your prompt</label>
            <textarea id="playground-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} data-testid="input-playground-prompt" className="mt-2 w-full resize-none rounded-xl border border-input bg-background px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
              {suggestedPrompts.map((suggestedPrompt) => (
                <button key={suggestedPrompt} type="button" onClick={() => setPrompt(suggestedPrompt)} className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground" data-testid="button-suggested-prompt">
                  {suggestedPrompt}
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div><label htmlFor="playground-model" className="mb-2 block text-xs font-semibold text-muted-foreground">Model <span className="font-normal">(optional)</span></label><input id="playground-model" value={model} onChange={(event) => setModel(event.target.value)} placeholder="Relay default" data-testid="input-playground-model" className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></div>
              <div><label htmlFor="playground-temperature" className="mb-2 block text-xs font-semibold text-muted-foreground">Temperature</label><select id="playground-temperature" value={temperature} onChange={(event) => setTemperature(event.target.value)} data-testid="select-playground-temperature" className="w-full appearance-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"><option value="0">0.0 — precise</option><option value="0.4">0.4 — balanced</option><option value="0.8">0.8 — expressive</option><option value="1.2">1.2 — exploratory</option></select></div>
            </div>
            <button type="submit" disabled={chat.isPending || !prompt.trim()} data-testid="button-send-playground" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_18px_hsl(var(--primary)/.2)] disabled:cursor-not-allowed disabled:opacity-50">{chat.isPending ? <><Loader2 size={16} className="animate-spin" /> Routing request...</> : <><Send size={16} /> Route through the relay</>}</button>
          </form>
          <div className="min-w-0 min-h-[350px] bg-[hsl(var(--background)/.7)] p-5 sm:p-7">
            <div className="mb-5 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><span className="size-2 rounded-full bg-primary" /> Relay response</div>
            {chat.isPending ? <div className="space-y-3" data-testid="status-playground-loading"><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /><div className="h-3 w-full animate-pulse rounded bg-muted" /><div className="h-3 w-5/6 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /></div> : chat.isError ? <div className="rounded-xl border border-accent/40 bg-accent/10 p-4" data-testid="status-playground-error"><div className="flex items-center gap-2 font-semibold"><RefreshCw size={15} /> The relay could not complete that request.</div><p className="mt-2 text-sm leading-6 text-muted-foreground">A provider may be at its limit. Try again and the pool will choose the next healthy path.</p><button type="button" onClick={() => chat.reset()} data-testid="button-dismiss-playground-error" className="mt-3 text-xs font-bold text-primary">Clear error</button></div> : response ? <div data-testid="content-playground-response"><p className="whitespace-pre-wrap text-[15px] leading-7">{response.content}</p><div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/70 pt-4 text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">Routed via {response.provider}</span><span>{response.model}</span><span>{response.fallbackCount} fallback{response.fallbackCount === 1 ? '' : 's'}</span></div></div> : <div className="flex min-h-[280px] flex-col items-center justify-center text-center text-muted-foreground"><Sparkles size={22} className="mb-3 text-accent" /><p className="text-sm font-semibold text-foreground">Your response will land here.</p><p className="mt-1 max-w-xs text-xs leading-5">We show the provider and fallbacks so the abstraction never becomes a black box.</p></div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Contribute() {
  const providersQuery = useListRelayProviders({ query: { queryKey: getListRelayProvidersQueryKey() } });
  const addKey = useAddRelayKey();
  const queryClient = useQueryClient();
  const providers = (providersQuery.data ?? fallbackProviders).filter((provider) => provider.id === 'openrouter-free' || provider.id === 'gemini-free');
  const [providerId, setProviderId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');
  const [consent, setConsent] = useState(false);
  const [submittedKey, setSubmittedKey] = useState<{ label: string; maskedKey: string } | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!providerId || apiKey.length < 8 || !consent || addKey.isPending) return;
    addKey.mutate({ data: { providerId, apiKey, ...(label.trim() ? { label: label.trim() } : {}), consent } }, {
      onSuccess: (key) => {
        setSubmittedKey({ label: key.label, maskedKey: key.maskedKey });
        setApiKey('');
        setLabel('');
        setConsent(false);
        queryClient.invalidateQueries({ queryKey: getListRelayProvidersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRelayStatsQueryKey() });
      },
    });
  };
  return (
    <section id="contribute" className="container-wide scroll-mt-24 py-20 md:py-28">
      <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
        <div><div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-primary"><KeyRound size={14} /> Share a little capacity</div><h2 className="text-3xl font-bold tracking-[-.045em] md:text-[42px] md:leading-[1.08]">A spare quota can become someone’s reliable Tuesday.</h2><p className="mt-5 text-[15px] leading-7 text-muted-foreground">Contribute a provider key and the relay uses it only for routed AI requests. You keep ownership; the community gets another healthy path.</p><div className="mt-8 space-y-4"><div className="flex gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><LockKeyhole size={15} /></span><div><p className="text-sm font-bold">Stored encrypted, shown masked</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Your raw key is never returned to the browser after submission.</p></div></div><div className="flex gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-[#b45c42]"><ShieldCheck size={15} /></span><div><p className="text-sm font-bold">No prompts are attached to your key</p><p className="mt-1 text-xs leading-5 text-muted-foreground">We track routing health and quota behavior, not personal request content.</p></div></div></div></div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-7">
          {submittedKey ? <div className="flex min-h-[385px] flex-col items-center justify-center text-center" data-testid="status-key-success"><span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><Check size={25} /></span><h3 className="mt-5 text-xl font-bold">Key added to the pool.</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{submittedKey.label || 'Your contribution'} is now available as a masked, health-checked route.</p><div className="mono mt-5 rounded-lg bg-muted px-4 py-2 text-xs text-muted-foreground">{submittedKey.maskedKey}</div><button type="button" onClick={() => setSubmittedKey(null)} data-testid="button-add-another-key" className="mt-6 text-sm font-bold text-primary hover:underline">Add another key</button></div> : <form onSubmit={submit} data-testid="form-contribute-key"><div className="mb-6 flex items-center justify-between"><div><h3 className="font-bold">Add a provider key</h3><p className="mt-1 text-xs text-muted-foreground">Takes less than a minute.</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-primary">Encrypted</span></div>
            <label htmlFor="key-provider" className="mb-2 block text-xs font-bold uppercase tracking-[.08em] text-muted-foreground">Provider</label>
            <div className="relative"><select id="key-provider" value={providerId} onChange={(event) => setProviderId(event.target.value)} data-testid="select-key-provider" className="w-full appearance-none rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"><option value="">Choose a provider</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {provider.model}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground" /></div>
            <label htmlFor="key-api-key" className="mb-2 mt-5 block text-xs font-bold uppercase tracking-[.08em] text-muted-foreground">API key</label><input id="key-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} minLength={8} placeholder="Paste your provider key" data-testid="input-api-key" className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
            <label htmlFor="key-label" className="mb-2 mt-5 block text-xs font-bold uppercase tracking-[.08em] text-muted-foreground">Label <span className="font-normal normal-case tracking-normal">(optional)</span></label><input id="key-label" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={48} placeholder="e.g. weekend pool" data-testid="input-key-label" className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
            <label className="mt-5 flex cursor-pointer items-start gap-3 text-xs leading-5 text-muted-foreground"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} data-testid="input-key-consent" className="mt-0.5 size-4 accent-[hsl(var(--primary))]" /><span>I understand this key will be used for community-routed requests and can be removed by the relay operator.</span></label>
            {addKey.isError && <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive" data-testid="status-key-error">That key could not be added. Check the provider and try again.</p>}
            <button type="submit" disabled={!providerId || apiKey.length < 8 || !consent || addKey.isPending} data-testid="button-submit-key" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_18px_hsl(var(--primary)/.2)] disabled:cursor-not-allowed disabled:opacity-50">{addKey.isPending ? <><Loader2 size={16} className="animate-spin" /> Adding securely...</> : <><KeyRound size={16} /> Add key to relay</>}</button>
          </form>}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 border-t border-border/70 bg-[hsl(var(--foreground))] py-20 text-[hsl(var(--background))] md:py-28">
      <div className="container-wide">
        <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr] lg:gap-24">
          <div><div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[hsl(var(--accent))]"><ArrowRight size={14} /> The transparent version</div><h2 className="text-3xl font-bold tracking-[-.045em] md:text-[42px] md:leading-[1.08]">Many small free quotas. One dependable path.</h2><p className="mt-5 text-[15px] leading-7 text-[hsl(var(--background)/.65)]">RelayMesh is deliberately boring in the best way: a compatibility layer that makes the useful part of community capacity easier to reach.</p></div>
          <div className="grid gap-0 sm:grid-cols-3">
            {[['01', 'Contributors add capacity', 'Provider keys join the pool with explicit consent and a masked public record.'], ['02', 'The relay checks the route', 'Health signals, limits, and recent failures shape which key gets a request.'], ['03', 'Your app stays unchanged', 'Point an OpenAI-compatible client at one endpoint. The relay absorbs the churn.']].map(([number, title, description], index) => <div key={number} className={`border-t border-[hsl(var(--background)/.18)] py-5 sm:px-5 ${index > 0 ? 'sm:border-l sm:pl-6' : 'sm:pl-0'}`}><span className="mono text-xs text-[hsl(var(--accent))]">{number}</span><h3 className="mt-6 text-base font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--background)/.62)]">{description}</p></div>)}
          </div>
        </div>
        <div className="mt-16 grid gap-4 border-t border-[hsl(var(--background)/.18)] pt-8 md:grid-cols-3">
          <div className="flex items-center gap-3 text-sm"><ShieldCheck className="text-[hsl(var(--accent))]" size={18} /><span>No prompt logging in the key pool</span></div>
          <div className="flex items-center gap-3 text-sm"><RefreshCw className="text-[hsl(var(--accent))]" size={18} /><span>Automatic fallback on provider limits</span></div>
          <div className="flex items-center gap-3 text-sm"><Code2 className="text-[hsl(var(--accent))]" size={18} /><span>Works with existing OpenAI clients</span></div>
        </div>
      </div>
    </section>
  );
}

function Endpoint() {
  const statsQuery = useGetRelayStats({ query: { queryKey: getGetRelayStatsQueryKey() } });
  const [copied, setCopied] = useState(false);
  const endpoint = statsQuery.data?.endpoint
    ? new URL(statsQuery.data.endpoint, window.location.origin).toString()
    : new URL('/api/relay/chat', window.location.origin).toString();
  const copy = async () => {
    try { await navigator.clipboard.writeText(endpoint); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  };
  return (
    <section id="endpoint" className="container-wide scroll-mt-24 py-20 md:py-28">
      <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-primary p-7 text-primary-foreground shadow-[var(--shadow-md)] sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border-[24px] border-primary-foreground/10" /><div className="pointer-events-none absolute -bottom-28 right-28 size-72 rounded-full border-[1px] border-accent/45" />
        <div className="relative z-10 grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div><div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-primary-foreground/70"><Code2 size={14} /> One endpoint, familiar clients</div><h2 className="max-w-2xl text-3xl font-bold tracking-[-.045em] sm:text-[42px] sm:leading-[1.05]">Change one line. Keep your client.</h2><p className="mt-4 max-w-xl text-[15px] leading-7 text-primary-foreground/75">Use the endpoint anywhere an OpenAI-compatible base URL is accepted. The routing and fallback work stays behind it.</p></div>
          <div className="min-w-0 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-3 backdrop-blur-sm sm:min-w-[450px]"><div className="flex min-w-0 items-center gap-3 rounded-xl bg-[hsl(var(--foreground)/.2)] px-4 py-3"><div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:thin]"><span className="mono inline-block whitespace-nowrap text-xs sm:text-sm" data-testid="text-relay-endpoint">{endpoint}</span></div><button type="button" onClick={copy} data-testid="button-copy-endpoint" className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[hsl(var(--background))] px-3 py-2 text-xs font-bold text-[hsl(var(--foreground))] transition-transform hover:scale-[1.03]">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button></div><p className="mt-3 flex items-center gap-1.5 px-1 text-[11px] text-primary-foreground/60"><ExternalLink className="shrink-0" size={12} /> Compatible with standard SDK baseURL settings</p></div>
        </div>
      </div>
    </section>
  );
}

function Home() {
  return (
    <Shell>
      <main>
        <section className="surface-grid relative overflow-hidden border-b border-border/70">
          <div className="pointer-events-none absolute right-[8%] top-16 hidden size-[420px] rounded-full border border-primary/10 md:block" /><div className="pointer-events-none absolute right-[13%] top-28 hidden size-[300px] rounded-full border border-accent/20 md:block" />
          <div className="container-wide grid min-h-[560px] items-center gap-14 py-20 md:grid-cols-[1.05fr_.95fr] md:py-28">
            <div className="animate-rise relative z-10"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.13em] text-primary"><span className="size-1.5 rounded-full bg-primary" /> Open, community-powered infrastructure</div><h1 className="max-w-3xl text-[clamp(3.25rem,7vw,6.4rem)] font-bold leading-[.92] tracking-[-.075em] text-foreground">One reliable path to <span className="text-primary">AI.</span></h1><p className="mt-7 max-w-xl text-[17px] leading-8 text-muted-foreground">RelayMesh combines many small, free provider quotas into one transparent OpenAI-compatible endpoint — with health checks and graceful fallbacks built in.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><a href="#playground" data-testid="hero-cta-playground" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground transition-all hover:-translate-y-1 hover:shadow-[0_10px_22px_hsl(var(--primary)/.22)]">Try the playground <ArrowRight size={16} /></a><a href="#contribute" data-testid="hero-cta-contribute" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-bold transition-all hover:-translate-y-1 hover:border-primary/40">Contribute capacity <KeyRound size={15} /></a></div><p className="mt-5 text-xs text-muted-foreground"><span className="font-bold text-foreground">Transparent by default.</span> See the provider, fallback count, and health story for every route.</p></div>
            <div className="animate-rise delay-2 relative mx-auto w-full max-w-[470px]">
              <div className="animate-drift absolute -right-2 -top-5 z-20 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-md)] sm:-right-8"><div className="flex items-center gap-2 text-xs font-bold"><span className="size-2 rounded-full bg-primary" /> Route healthy</div><div className="mono mt-1 text-[10px] text-muted-foreground">fallback ready · 3 providers</div></div>
              <div className="rounded-[28px] border border-primary/20 bg-card p-3 shadow-[0_25px_70px_rgba(28,61,55,.16)]"><div className="rounded-[21px] border border-border/80 bg-background p-5 sm:p-7"><div className="flex items-center justify-between border-b border-border/70 pb-4"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Network size={15} /></span><span className="text-xs font-bold">relaymesh.community</span></div><span className="mono text-[10px] text-muted-foreground">LIVE</span></div><div className="py-8"><div className="mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Request flow</div><div className="space-y-3"><div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"><span className="mono grid size-7 place-items-center rounded-md bg-accent/20 text-[10px] font-bold text-[#a95b43]">01</span><div className="flex-1"><div className="text-xs font-bold">Your OpenAI client</div><div className="mono mt-1 text-[10px] text-muted-foreground">chat.completions.create()</div></div><ArrowRight size={14} className="text-muted-foreground" /></div><div className="ml-7 h-4 border-l border-dashed border-primary/40" /><div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3"><span className="mono grid size-7 place-items-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">02</span><div className="flex-1"><div className="text-xs font-bold text-primary">RelayMesh</div><div className="mono mt-1 text-[10px] text-muted-foreground">health → route → fallback</div></div><Activity size={14} className="text-primary" /></div><div className="ml-7 h-4 border-l border-dashed border-primary/40" /><div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"><span className="mono grid size-7 place-items-center rounded-md bg-secondary text-[10px] font-bold">03</span><div className="flex-1"><div className="text-xs font-bold">Healthy provider key</div><div className="mono mt-1 text-[10px] text-muted-foreground">response returned to you</div></div><Check size={14} className="text-primary" /></div></div></div><div className="flex items-center justify-between border-t border-border/70 pt-4 text-[10px] text-muted-foreground"><span>Built for small teams</span><span className="mono">no lock-in</span></div></div></div>
              <div className="absolute -bottom-7 -left-7 z-20 hidden rounded-xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-md)] sm:block"><div className="mono text-[10px] text-muted-foreground">community pool</div><div className="mt-1 text-lg font-bold tracking-[-.04em]">gets stronger together</div></div>
            </div>
          </div>
        </section>
        <StatStrip />
        <ProviderHealth />
        <Playground />
        <Contribute />
        <HowItWorks />
        <Endpoint />
      </main>
    </Shell>
  );
}

function Router() {
  return <Switch><Route path="/" component={Home} /><Route component={() => <div className="grid min-h-[100dvh] place-items-center"><div className="text-center"><h1 className="text-3xl font-bold">Page not found</h1><Link href="/" className="mt-4 inline-block text-primary hover:underline" data-testid="link-not-found-home">Return home</Link></div></div>} /></Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><ErrorBoundary><Router /></ErrorBoundary><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;