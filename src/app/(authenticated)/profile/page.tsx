"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function ProfilePage() {
  const profile = useQuery(api.userProfiles.getMine);
  const createProfile = useMutation(api.userProfiles.create);
  const updateProfile = useMutation(api.userProfiles.update);

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [inn, setInn] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const hasAutoCreated = useRef(false);
  const hasLoadedForm = useRef(false);

  // Auto-create profile on first visit if it doesn't exist
  useEffect(() => {
    if (profile === null && !hasAutoCreated.current) {
      hasAutoCreated.current = true;
      createProfile({ name: "" }).catch(() => {
        // Ignore — may already exist
      });
    }
  }, [profile, createProfile]);

  // Populate form when profile loads
  useEffect(() => {
    if (profile && !hasLoadedForm.current) {
      setName(profile.name ?? "");
      setCompanyName(profile.companyName ?? "");
      setInn(profile.inn ?? "");
      hasLoadedForm.current = true;
    }
  }, [profile]);

  // Auto-clear status message
  useEffect(() => {
    if (!statusMessage) return;
    const t = setTimeout(() => setStatusMessage(null), 3000);
    return () => clearTimeout(t);
  }, [statusMessage]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name, companyName, inn });
      setStatusMessage("Профиль сохранён");
    } catch (err) {
      console.error("Profile save failed:", err);
      setStatusMessage("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (profile === undefined) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-50">Профиль</h1>

      {statusMessage && (
        <div className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-4 py-2 text-sm text-emerald-300">
          {statusMessage}
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6">
        <div>
          <label className="mb-1 block text-xs text-slate-400">Имя</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваше имя"
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Название компании
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="ООО Компания"
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">ИНН</label>
          <input
            type="text"
            value={inn}
            onChange={(e) => setInn(e.target.value)}
            placeholder="1234567890"
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
