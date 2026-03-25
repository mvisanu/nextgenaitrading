"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
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
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";

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

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [credDialogOpen, setCredDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?callbackUrl=/profile");
    }
  }, [authLoading, user, router]);

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
    mutationFn: (body: CreateBrokerCredentialRequest) =>
      brokerApi.create(body),
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

  if (authLoading || !user) return null;

  return (
    <AppShell title="Profile">
      <div className="space-y-6 max-w-2xl">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">User Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleProfileSubmit(onProfileSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Display Name</Label>
                  <Input
                    placeholder="Your name"
                    {...regProfile("display_name")}
                    disabled={profileLoading || savingProfile}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Input
                    placeholder="America/New_York"
                    {...regProfile("timezone")}
                    disabled={profileLoading || savingProfile}
                  />
                  {profileErrors.timezone && (
                    <p className="text-xs text-destructive">
                      {profileErrors.timezone.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Default Symbol</Label>
                  <Input
                    placeholder="BTC-USD"
                    {...regProfile("default_symbol")}
                    disabled={profileLoading || savingProfile}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Default Strategy Mode</Label>
                  <Select
                    defaultValue={profile?.default_mode ?? undefined}
                    onValueChange={(v) =>
                      setProfileValue("default_mode", v as StrategyMode)
                    }
                    disabled={profileLoading || savingProfile}
                  >
                    <SelectTrigger>
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
              </div>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save Profile
              </Button>
            </form>
          </CardContent>
        </Card>

        <Separator />

        {/* Broker Credentials Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Broker Credentials</CardTitle>
            <Button
              size="sm"
              onClick={() => {
                resetCred();
                setCredDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Credential
            </Button>
          </CardHeader>
          <CardContent>
            {credsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : credentials.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No credentials saved. Add your Alpaca or Robinhood API keys to
                enable live trading.
              </p>
            ) : (
              <div className="space-y-3">
                {credentials.map((cred) => (
                  <CredentialRow
                    key={cred.id}
                    credential={cred}
                    onTest={() => testCredential(cred.id)}
                    onDelete={() => setDeleteConfirmId(cred.id)}
                    isTestLoading={testingCred}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Credential Dialog */}
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

      {/* Delete Confirmation Dialog */}
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

// ─── Credential Row Component ─────────────────────────────────────────────────

interface CredentialRowProps {
  credential: BrokerCredential;
  onTest: () => void;
  onDelete: () => void;
  isTestLoading: boolean;
}

function CredentialRow({
  credential,
  onTest,
  onDelete,
  isTestLoading,
}: CredentialRowProps) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{credential.profile_name}</span>
          {credential.provider === "alpaca" ? (
            <Badge variant="alpaca" className="text-xs">
              Alpaca · Stocks &amp; ETFs
            </Badge>
          ) : (
            <Badge variant="robinhood" className="text-xs">
              Robinhood · Crypto only
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          {credential.api_key}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onTest}
          disabled={isTestLoading}
          className="text-xs"
        >
          Test
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
