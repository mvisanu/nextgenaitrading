"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { brokerApi, profileApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import type {
  BrokerCredential,
  BrokerProvider,
  CreateBrokerCredentialRequest,
  StrategyMode,
  UpdateProfileRequest,
} from "@/types";
import {
  AlertTriangle,
  BadgeCheck,
  Download,
  Fingerprint,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  Shield,
  Settings2,
  Sliders,
  Trash2,
  User2,
} from "lucide-react";

// ─── Profile Form ─────────────────────────────────────────────────────────────

const profileSchema = z.object({
  display_name: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  default_symbol: z.string().max(20).optional(),
  default_mode: z
    .enum(["conservative", "aggressive", "ai-pick", "buy-low-sell-high"])
    .optional(),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

// ─── Credential Form ──────────────────────────────────────────────────────────

const credentialSchema = z.object({
  provider: z.enum(["alpaca", "robinhood"]),
  profile_name: z.string().min(1, "Profile name is required"),
  api_key: z.string().min(1, "API key is required"),
  secret_key: z.string().min(1, "Secret key is required"),
  base_url: z.string().optional(),
  paper_trading: z.boolean().optional(),
});
type CredentialFormValues = z.infer<typeof credentialSchema>;

// ─── Vertical Nav Tabs ────────────────────────────────────────────────────────

type TabId = "identity" | "credentials" | "api-keys" | "preferences" | "security";

const NAV_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "identity",    label: "Identity",     icon: <Fingerprint className="h-4 w-4" /> },
  { id: "credentials", label: "Credentials",  icon: <BadgeCheck className="h-4 w-4" /> },
  { id: "api-keys",   label: "API Keys",      icon: <KeyRound className="h-4 w-4" /> },
  { id: "preferences",label: "Preferences",   icon: <Sliders className="h-4 w-4" /> },
  { id: "security",   label: "Security",      icon: <Shield className="h-4 w-4" /> },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [credDialogOpen, setCredDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("identity");

  // Security & Alerts toggle state (UI only — no backend endpoint for these)
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(false);
  const [twoFactor, setTwoFactor] = useState(true);

  // ── Profile data ────────────────────────────────────────────────────────────
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: profileApi.get,
  });

  const {
    register: regProfile,
    handleSubmit: handleProfileSubmit,
    setValue: setProfileValue,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      display_name: profile?.display_name ?? "",
      timezone: profile?.timezone ?? "",
      default_symbol: profile?.default_symbol ?? "",
      default_mode: (profile?.default_mode as StrategyMode | undefined) ?? undefined,
    },
  });

  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: (body: UpdateProfileRequest) => profileApi.update(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile saved");
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to save profile"));
    },
  });

  // ── Credentials ─────────────────────────────────────────────────────────────
  const { data: credentials = [], isLoading: credsLoading } = useQuery({
    queryKey: ["broker", "credentials"],
    queryFn: brokerApi.list,
  });

  const {
    register: regCred,
    handleSubmit: handleCredSubmit,
    watch: watchCred,
    setValue: setCredValue,
    reset: resetCred,
    formState: { errors: credErrors },
  } = useForm<CredentialFormValues>({
    resolver: zodResolver(credentialSchema),
    defaultValues: { provider: "alpaca", paper_trading: false },
  });

  const provider = watchCred("provider");
  const paperTrading = watchCred("paper_trading");

  const { mutate: createCredential, isPending: creatingCred } = useMutation({
    mutationFn: (body: CreateBrokerCredentialRequest) => brokerApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["broker", "credentials"] });
      setCredDialogOpen(false);
      resetCred();
      toast.success("Credential saved");
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to save credential"));
    },
  });

  const { mutate: deleteCredential, isPending: deletingCred } = useMutation({
    mutationFn: (id: number) => brokerApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["broker", "credentials"] });
      setDeleteConfirmId(null);
      toast.success("Credential deleted");
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to delete credential"));
    },
  });

  const { mutate: testCredential, isPending: testingCred } = useMutation({
    mutationFn: (id: number) => brokerApi.test(id),
    onSuccess: ({ ok }) => {
      if (ok) {
        toast.success("Connection successful");
      } else {
        toast.error("Connection failed — check your credentials");
      }
    },
    onError: () => {
      toast.error("Connection test failed");
    },
  });

  function onProfileSubmit(values: ProfileFormValues) {
    const body: UpdateProfileRequest = {};
    if (values.display_name) body.display_name = values.display_name;
    if (values.timezone) body.timezone = values.timezone;
    if (values.default_symbol) body.default_symbol = values.default_symbol;
    if (values.default_mode) body.default_mode = values.default_mode;
    saveProfile(body);
  }

  function onCredSubmit(values: CredentialFormValues) {
    const body: CreateBrokerCredentialRequest = {
      provider: values.provider,
      profile_name: values.profile_name,
      api_key: values.api_key,
      secret_key: values.secret_key,
    };
    if (values.paper_trading && values.provider === "alpaca") {
      body.base_url = "https://paper-api.alpaca.markets";
    }
    createCredential(body);
  }

  // Derive display name and initials
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "AI Trader";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <AppShell title="Profile">
      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <section className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div
            className="h-16 w-16 rounded-sm bg-surface-high flex items-center justify-center flex-shrink-0"
            data-testid="profile-avatar"
          >
            <span className="text-xl font-bold text-primary">{initials}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground" data-testid="profile-display-name">
              {displayName}
            </h1>
            <span className="text-3xs uppercase tracking-widest text-primary font-bold block mb-1">
              NextGen Trading
            </span>
            <span className="text-2xs text-muted-foreground tabular-nums">
              {user?.email ?? "—"}
            </span>
          </div>
        </div>

        {/* Header actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-border/30 bg-surface-high hover:bg-surface-highest gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export Logs
          </Button>
          <Button
            size="sm"
            className="text-xs bg-primary text-background hover:bg-primary/90 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Cloud Sync
          </Button>
        </div>
      </section>

      {/* ── Body: Sidebar Nav + Content ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-6 min-h-[500px]">
        {/* Vertical nav */}
        <nav className="hidden sm:flex flex-col w-44 flex-shrink-0 bg-surface-low rounded-sm border border-border/10 overflow-hidden">
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex items-center gap-2.5 px-4 py-3 text-left transition-colors",
                  "text-[11px] uppercase tracking-widest font-semibold",
                  isActive
                    ? "text-primary bg-surface-mid border-l-[3px] border-primary"
                    : "text-muted-foreground hover:bg-surface-mid hover:text-foreground border-l-[3px] border-transparent",
                ].join(" ")}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Mobile tab strip */}
        <div className="sm:hidden w-full -mt-2 mb-4">
          <div className="flex overflow-x-auto gap-1 pb-1">
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "flex items-center gap-1.5 px-3 py-1.5 whitespace-nowrap rounded-sm text-[10px] uppercase tracking-widest font-semibold transition-colors flex-shrink-0",
                    isActive
                      ? "text-primary bg-surface-mid border border-primary/30"
                      : "text-muted-foreground bg-surface-low hover:text-foreground",
                  ].join(" ")}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left column — main panels */}
            <div className="lg:col-span-8 space-y-6">

              {/* ── Account Preferences ─────────────────────────────────────── */}
              {(activeTab === "identity" || activeTab === "preferences") && (
                <div
                  className="bg-surface-low rounded-sm border-l-2 border-primary p-6"
                  data-testid="account-preferences-panel"
                >
                  <h2 className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground mb-5 flex items-center gap-2">
                    <Settings2 className="h-3.5 w-3.5" />
                    Account Preferences
                  </h2>

                  <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      {/* Display Name */}
                      <div>
                        <label className="text-3xs uppercase tracking-widest text-muted-foreground font-bold mb-1 block">
                          Display Name
                        </label>
                        <input
                          className="bg-surface-lowest border-none p-2.5 text-xs focus:ring-1 focus:ring-primary w-full outline-none text-foreground rounded-sm"
                          placeholder="AI Trader"
                          {...regProfile("display_name")}
                          disabled={profileLoading || savingProfile}
                        />
                      </div>

                      {/* Timezone */}
                      <div>
                        <label className="text-3xs uppercase tracking-widest text-muted-foreground font-bold mb-1 block">
                          Default Timezone
                        </label>
                        <input
                          className="bg-surface-lowest border-none p-2.5 text-xs focus:ring-1 focus:ring-primary w-full outline-none text-foreground rounded-sm"
                          placeholder="America/New_York"
                          {...regProfile("timezone")}
                          disabled={profileLoading || savingProfile}
                        />
                        {profileErrors.timezone && (
                          <p className="text-2xs text-destructive mt-1">
                            {profileErrors.timezone.message}
                          </p>
                        )}
                      </div>

                      {/* Default Symbol */}
                      <div>
                        <label className="text-3xs uppercase tracking-widest text-muted-foreground font-bold mb-1 block">
                          Default Symbol
                        </label>
                        <input
                          className="bg-surface-lowest border-none p-2.5 text-xs focus:ring-1 focus:ring-primary w-full outline-none text-foreground tabular-nums rounded-sm"
                          placeholder="BTC-USD"
                          {...regProfile("default_symbol")}
                          disabled={profileLoading || savingProfile}
                        />
                      </div>
                    </div>

                    {/* Default Strategy Mode */}
                    <div className="max-w-xs">
                      <label className="text-3xs uppercase tracking-widest text-muted-foreground font-bold mb-1 block">
                        Default Strategy Mode
                      </label>
                      <Select
                        defaultValue={profile?.default_mode ?? undefined}
                        onValueChange={(v) =>
                          setProfileValue("default_mode", v as StrategyMode)
                        }
                        disabled={profileLoading || savingProfile}
                      >
                        <SelectTrigger className="bg-surface-lowest border-none text-xs h-9 rounded-sm focus:ring-1 focus:ring-primary">
                          <SelectValue placeholder="Select mode..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="conservative">Conservative</SelectItem>
                          <SelectItem value="aggressive">Aggressive</SelectItem>
                          <SelectItem value="ai-pick">AI Pick</SelectItem>
                          <SelectItem value="buy-low-sell-high">
                            Buy Low / Sell High
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={savingProfile}
                      className="bg-primary text-background hover:bg-primary/90 text-xs px-5"
                    >
                      {savingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Save Preferences
                    </Button>
                  </form>
                </div>
              )}

              {/* ── API Management (Broker Credentials) ─────────────────────── */}
              {(activeTab === "credentials" || activeTab === "api-keys") && (
                <div
                  className="bg-surface-low rounded-sm overflow-hidden"
                  data-testid="api-management-panel"
                >
                  {/* Panel header */}
                  <div className="px-6 py-4 border-b border-border/10 flex items-center justify-between">
                    <h2 className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2">
                      <KeyRound className="h-3.5 w-3.5" />
                      Broker Credentials
                    </h2>
                    <button
                      onClick={() => {
                        resetCred();
                        setCredDialogOpen(true);
                      }}
                      className="text-2xs font-bold text-primary hover:underline uppercase tracking-widest"
                    >
                      + Add Credential
                    </button>
                  </div>

                  {/* Table */}
                  {credsLoading ? (
                    <div className="px-6 py-8 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading credentials...
                    </div>
                  ) : credentials.length === 0 ? (
                    <div className="px-6 py-8 text-xs text-muted-foreground">
                      No credentials saved. Add your Alpaca or Robinhood API keys to enable live trading.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-mid/50 text-3xs uppercase tracking-widest text-muted-foreground">
                            <th className="px-6 py-3 font-bold">Label</th>
                            <th className="px-6 py-3 font-bold">Key Fragment</th>
                            <th className="px-6 py-3 font-bold">Provider</th>
                            <th className="px-6 py-3 font-bold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {credentials.map((cred, i) => (
                            <tr
                              key={cred.id}
                              className={[
                                "hover:bg-surface-mid transition-colors",
                                i % 2 === 1 ? "bg-surface-mid/20" : "",
                              ].join(" ")}
                            >
                              <td className="px-6 py-4 text-xs font-semibold text-foreground">
                                {cred.profile_name}
                              </td>
                              <td className="px-6 py-4 text-xs text-muted-foreground tabular-nums font-mono">
                                {cred.api_key}
                              </td>
                              <td className="px-6 py-4">
                                {cred.provider === "alpaca" ? (
                                  <span className="text-3xs bg-surface-high px-1.5 py-0.5 rounded-sm text-muted-foreground uppercase tracking-wider font-bold">
                                    Alpaca
                                  </span>
                                ) : (
                                  <span className="text-3xs bg-surface-high px-1.5 py-0.5 rounded-sm text-muted-foreground uppercase tracking-wider font-bold">
                                    Robinhood
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => testCredential(cred.id)}
                                    disabled={testingCred}
                                    className="text-3xs uppercase tracking-widest font-bold text-muted-foreground hover:text-primary transition-colors"
                                  >
                                    Test
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(cred.id)}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Security & Alerts (left-col fallback when no right col active) ── */}
              {activeTab === "security" && (
                <div
                  className="bg-surface-low rounded-sm p-6 lg:hidden"
                  data-testid="security-panel-mobile"
                >
                  <SecurityPanel
                    emailNotifications={emailNotifications}
                    setEmailNotifications={setEmailNotifications}
                    priceAlerts={priceAlerts}
                    setPriceAlerts={setPriceAlerts}
                    twoFactor={twoFactor}
                    setTwoFactor={setTwoFactor}
                  />
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="lg:col-span-4 space-y-6">
              {/* ── Broker Cards ──────────────────────────────────────────────── */}
              {(activeTab === "identity" || activeTab === "credentials" || activeTab === "api-keys") && (
                <div
                  className="bg-surface-low rounded-sm border-t-2 border-primary p-6"
                  data-testid="brokers-panel"
                >
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2">
                      <Server className="h-3.5 w-3.5" />
                      Brokers
                    </h2>
                    <button
                      onClick={() => {
                        resetCred();
                        setCredDialogOpen(true);
                      }}
                      className="text-primary hover:bg-primary/10 rounded p-0.5 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {credsLoading ? (
                      <p className="text-xs text-muted-foreground">Loading...</p>
                    ) : credentials.length === 0 ? (
                      <button
                        onClick={() => {
                          resetCred();
                          setCredDialogOpen(true);
                        }}
                        className="w-full py-4 border border-dashed border-border/30 text-muted-foreground text-2xs font-bold uppercase tracking-widest hover:border-primary/50 hover:text-primary transition-all rounded-sm"
                      >
                        + Add New Credential
                      </button>
                    ) : (
                      <>
                        {credentials.map((cred) => (
                          <BrokerCard
                            key={cred.id}
                            credential={cred}
                            onTest={() => testCredential(cred.id)}
                            onDelete={() => setDeleteConfirmId(cred.id)}
                            isTestLoading={testingCred}
                          />
                        ))}
                        <button
                          onClick={() => {
                            resetCred();
                            setCredDialogOpen(true);
                          }}
                          className="w-full py-3 border border-dashed border-border/30 text-muted-foreground text-2xs font-bold uppercase tracking-widest hover:border-primary/50 hover:text-primary transition-all rounded-sm"
                        >
                          + Add New Credential
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Security & Alerts ──────────────────────────────────────────── */}
              {(activeTab === "identity" || activeTab === "security" || activeTab === "preferences") && (
                <div
                  className="bg-surface-low rounded-sm p-6 hidden lg:block"
                  data-testid="security-alerts-panel"
                >
                  <SecurityPanel
                    emailNotifications={emailNotifications}
                    setEmailNotifications={setEmailNotifications}
                    priceAlerts={priceAlerts}
                    setPriceAlerts={setPriceAlerts}
                    twoFactor={twoFactor}
                    setTwoFactor={setTwoFactor}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ────────────────────────────────────────────────────────── */}
          <footer className="mt-10 pt-6 border-t border-border/10 flex flex-col sm:flex-row justify-between items-center gap-3 text-3xs text-muted-foreground font-bold uppercase tracking-widest">
            <div className="flex gap-5">
              <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms of Execution</a>
              <a href="#" className="hover:text-foreground transition-colors">Infrastructure Status</a>
            </div>
            <div className="tabular-nums opacity-50">
              System Build: 0.9.44-Stable
            </div>
          </footer>
        </div>
      </div>

      {/* ── Add Credential Dialog ──────────────────────────────────────────────── */}
      <Dialog open={credDialogOpen} onOpenChange={setCredDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Broker Credential</DialogTitle>
            <DialogDescription>
              Your API keys are encrypted at rest and never returned in API
              responses.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCredSubmit(onCredSubmit)} className="space-y-4">
            {/* Provider */}
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select
                defaultValue="alpaca"
                onValueChange={(v) =>
                  setCredValue("provider", v as BrokerProvider)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alpaca">Alpaca (Stocks &amp; ETFs)</SelectItem>
                  <SelectItem value="robinhood">Robinhood (Crypto only)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Robinhood warning */}
            {provider === "robinhood" && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Robinhood credentials only support crypto trading. For stocks
                  and ETFs, add an Alpaca account.
                </AlertDescription>
              </Alert>
            )}

            {/* Profile name */}
            <div className="space-y-1.5">
              <Label>Profile Name</Label>
              <Input
                placeholder="My Alpaca Account"
                {...regCred("profile_name")}
              />
              {credErrors.profile_name && (
                <p className="text-xs text-destructive">
                  {credErrors.profile_name.message}
                </p>
              )}
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <Label>
                {provider === "alpaca" ? "API Key ID" : "API Key"}
              </Label>
              <Input {...regCred("api_key")} />
              {credErrors.api_key && (
                <p className="text-xs text-destructive">
                  {credErrors.api_key.message}
                </p>
              )}
            </div>

            {/* Secret Key */}
            <div className="space-y-1.5">
              <Label>
                {provider === "alpaca" ? "Secret Key" : "Private Key"}
              </Label>
              <Input type="password" {...regCred("secret_key")} />
              {credErrors.secret_key && (
                <p className="text-xs text-destructive">
                  {credErrors.secret_key.message}
                </p>
              )}
            </div>

            {/* Alpaca paper toggle */}
            {provider === "alpaca" && (
              <div className="flex items-center gap-3">
                <Switch
                  id="paper-trading"
                  checked={paperTrading ?? false}
                  onCheckedChange={(v) => setCredValue("paper_trading", v)}
                />
                <Label htmlFor="paper-trading">
                  Paper Trading
                  <span className="ml-1 text-muted-foreground text-xs">
                    (uses paper-api.alpaca.markets)
                  </span>
                </Label>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setCredDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creatingCred}>
                {creatingCred && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save Credential
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Credential?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The credential will be permanently
              removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deletingCred}
              onClick={() =>
                deleteConfirmId !== null && deleteCredential(deleteConfirmId)
              }
            >
              {deletingCred && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ─── Broker Card Component ────────────────────────────────────────────────────

interface BrokerCardProps {
  credential: BrokerCredential;
  onTest: () => void;
  onDelete: () => void;
  isTestLoading: boolean;
}

function BrokerCard({ credential, onTest, onDelete, isTestLoading }: BrokerCardProps) {
  return (
    <div className="bg-surface-mid border-l border-primary/40 p-4 rounded-sm relative group">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 bg-surface-high flex items-center justify-center rounded-sm flex-shrink-0">
          <Server className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-foreground truncate">
            {credential.profile_name}
          </h3>
          <p className="text-3xs text-primary uppercase font-bold tracking-widest">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-1 align-middle" />
            Connected
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs text-muted-foreground font-mono tabular-nums truncate">
          {credential.api_key}
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {credential.provider === "alpaca" ? (
            <span className="text-3xs bg-surface-high px-1.5 py-0.5 rounded-sm text-muted-foreground uppercase font-bold tracking-wider">
              Alpaca
            </span>
          ) : (
            <span className="text-3xs bg-surface-high px-1.5 py-0.5 rounded-sm text-muted-foreground uppercase font-bold tracking-wider">
              RH
            </span>
          )}
          <button
            onClick={onTest}
            disabled={isTestLoading}
            className="text-3xs uppercase font-bold text-muted-foreground hover:text-primary transition-colors tracking-widest"
          >
            Test
          </button>
          <button
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Security Panel Component ─────────────────────────────────────────────────

interface SecurityPanelProps {
  emailNotifications: boolean;
  setEmailNotifications: (v: boolean) => void;
  priceAlerts: boolean;
  setPriceAlerts: (v: boolean) => void;
  twoFactor: boolean;
  setTwoFactor: (v: boolean) => void;
}

function SecurityPanel({
  emailNotifications,
  setEmailNotifications,
  priceAlerts,
  setPriceAlerts,
  twoFactor,
  setTwoFactor,
}: SecurityPanelProps) {
  return (
    <>
      <h2 className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground mb-5 flex items-center gap-2">
        <Shield className="h-3.5 w-3.5" />
        Security &amp; Alerts
      </h2>

      <div className="space-y-5">
        {/* Email Notifications */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold text-foreground">Email Notifications</p>
            <p className="text-2xs text-muted-foreground">Executions and margin calls</p>
          </div>
          <Switch
            checked={emailNotifications}
            onCheckedChange={setEmailNotifications}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        {/* Price Alerts */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold text-foreground">Price Alerts</p>
            <p className="text-2xs text-muted-foreground">Push notifications for volatility</p>
          </div>
          <Switch
            checked={priceAlerts}
            onCheckedChange={setPriceAlerts}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        {/* Two-Factor Auth */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold text-foreground">Two-Factor Auth</p>
            <p className="text-2xs text-muted-foreground">Hardware key or authenticator</p>
          </div>
          <Switch
            checked={twoFactor}
            onCheckedChange={setTwoFactor}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        {/* Deactivate Account */}
        <div className="pt-4 border-t border-border/10">
          <button className="w-full py-2 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white transition-colors text-3xs font-bold uppercase tracking-widest rounded-sm">
            Deactivate Account
          </button>
        </div>
      </div>
    </>
  );
}
