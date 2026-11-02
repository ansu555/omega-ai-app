"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Settings, Eye, EyeOff, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAccount } from "wagmi";

// ── Constants ─────────────────────────────────────────────────────────────────

const MODELS = [
  { value: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { value: "openai/gpt-4o", label: "GPT-4o" },
  { value: "qwen/qwen3-8b", label: "Qwen3 8B" },
] as const;

const MODES = [
  {
    value: "autonomous",
    label: "Autonomous",
    description: "Agent signs & submits trades automatically on consensus",
  },
  {
    value: "assisted",
    label: "Assisted",
    description: "Research + one-click approve before any trade",
  },
  {
    value: "solo",
    label: "Solo",
    description: "Research only — no execution, minimal audit receipt",
  },
] as const;

type Mode = "autonomous" | "assisted" | "solo";

interface UserSettings {
  model: string | null;
  mode: Mode | null;
  hasApiKey: boolean;
  updatedAt?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentSettingsCard() {
  const { address: userAddress } = useAccount();

  const [settings, setSettings] = useState<UserSettings>({
    model: "anthropic/claude-sonnet-4-5",
    mode: "assisted",
    hasApiKey: false,
  });
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!userAddress) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user-settings", {
        headers: { "x-wallet-address": userAddress },
      });
      if (res.ok) {
        const data = (await res.json()) as UserSettings;
        setSettings(data);
      }
    } catch {
      // silently fail — use defaults
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!userAddress) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    const body: Record<string, string> = {};
    if (settings.model) body.model = settings.model;
    if (settings.mode) body.mode = settings.mode;
    if (apiKey.trim()) body.apiKey = apiKey.trim();

    try {
      const res = await fetch("/api/user-settings", {
        method: "PUT",
        headers: {
          "x-wallet-address": userAddress,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Save failed");
      }
      setSaved(true);
      setApiKey("");
      setShowKey(false);
      await fetchSettings();
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const isIncomplete = !settings.hasApiKey && !apiKey.trim();

  if (!userAddress) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="glass-card rounded-2xl p-6 h-full flex flex-col items-center justify-center gap-2"
      >
        <Settings className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Connect wallet to configure agent</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="glass-card rounded-2xl p-6 h-full flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-primary/20">
          <Settings className="w-4 h-4 text-primary" />
        </div>
        <h3 className="text-primary font-medium text-sm">Agent Settings</h3>
        {isIncomplete && (
          <span className="ml-auto flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5" />
            API key needed
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading settings…
        </div>
      ) : (
        <div className="flex flex-col gap-4 flex-1">
          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              OpenRouter API Key
            </label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={
                  settings.hasApiKey
                    ? "•••••••••••••••••• (saved)"
                    : "sk-or-v1-…"
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-secondary border-border pr-9 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {settings.hasApiKey && !apiKey && (
              <p className="text-xs text-success">API key saved. Paste a new one to replace it.</p>
            )}
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Model
            </label>
            <Select
              value={settings.model ?? "anthropic/claude-sonnet-4-5"}
              onValueChange={(val) =>
                setSettings((prev) => ({ ...prev, model: val }))
              }
            >
              <SelectTrigger className="bg-secondary border-border text-sm">
                <SelectValue placeholder="Select model…" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-sm">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mode */}
          <div className="space-y-1.5 flex-1">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Trading Mode
            </label>
            <RadioGroup
              value={settings.mode ?? "assisted"}
              onValueChange={(val) =>
                setSettings((prev) => ({ ...prev, mode: val as Mode }))
              }
              className="space-y-2"
            >
              {MODES.map((m) => (
                <div
                  key={m.value}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    settings.mode === m.value
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, mode: m.value }))
                  }
                >
                  <RadioGroupItem
                    value={m.value}
                    id={`mode-${m.value}`}
                    className="mt-0.5 shrink-0"
                  />
                  <div>
                    <Label
                      htmlFor={`mode-${m.value}`}
                      className="text-sm font-medium text-foreground cursor-pointer"
                    >
                      {m.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {m.description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {/* Save */}
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            onClick={handleSave}
            disabled={saving || saved}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saved && <Check className="w-4 h-4 mr-2" />}
            {saved ? "Saved!" : "Save Settings"}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
