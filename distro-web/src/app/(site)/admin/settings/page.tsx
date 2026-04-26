"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import { normalizeDistrictsList } from "@/lib/utils";

interface District {
  id: string;
  name: string;
  active: boolean;
  deliveryFee: number;
  estimatedDays: number;
}

interface PlatformConfig {
  companyName: string;
  companyAddress: string;
  minOrderAmount: number;
  supportPhone: string;
  supportEmail: string;
}

interface DistrictEdit {
  active: boolean;
  deliveryFee: string;
  estimatedDays: string;
}

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const [districtEdits, setDistrictEdits] = useState<Record<string, DistrictEdit>>({});
  const [configForm, setConfigForm] = useState<PlatformConfig>({
    companyName: "",
    companyAddress: "",
    minOrderAmount: 0,
    supportPhone: "",
    supportEmail: "",
  });
  const [configSaved, setConfigSaved] = useState(false);

  const { data: districts = [], isLoading: districtsLoading } = useQuery<District[]>({
    queryKey: ["admin-districts"],
    queryFn: () =>
      api.get("/districts?all=1").then((r) => normalizeDistrictsList<District>(r.data)),
  });

  const { data: config } = useQuery<PlatformConfig>({
    queryKey: ["admin-config"],
    queryFn: () => api.get("/settings").then((r) => r.data),
  });

  useEffect(() => {
    if (config) setConfigForm(config);
  }, [config]);

  useEffect(() => {
    if (districts.length > 0) {
      const initial: Record<string, DistrictEdit> = {};
      districts.forEach((d) => {
        initial[d.id] = {
          active: d.active,
          deliveryFee: String(d.deliveryFee),
          estimatedDays: String(d.estimatedDays),
        };
      });
      setDistrictEdits(initial);
    }
  }, [districts]);

  const updateDistrict = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { active: boolean; deliveryFee: number; estimatedDays: number };
    }) => api.patch(`/districts/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-districts"] });
      qc.invalidateQueries({ queryKey: ["districts"] });
    },
  });

  const updateConfig = useMutation({
    mutationFn: (data: PlatformConfig) => api.patch("/settings", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-config"] });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    },
  });

  function saveDistrict(id: string) {
    const edit = districtEdits[id];
    if (!edit) return;
    updateDistrict.mutate({
      id,
      data: {
        active: edit.active,
        deliveryFee: Number(edit.deliveryFee),
        estimatedDays: Number(edit.estimatedDays),
      },
    });
  }

  function updateDistrictEdit(id: string, key: keyof DistrictEdit, value: string | boolean) {
    setDistrictEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  }

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="font-grotesk font-bold text-2xl text-ink">Settings</h1>

      {/* Delivery Districts */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-grotesk font-semibold text-base text-ink">
            Delivery Districts
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Changes are reflected immediately on the /coverage page.
          </p>
        </div>

        {districtsLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-blue-pale rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {districts.map((d) => {
              const edit = districtEdits[d.id];
              if (!edit) return null;
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-off-white transition-colors"
                >
                  {/* Active toggle */}
                  <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={edit.active}
                      onChange={(e) =>
                        updateDistrictEdit(d.id, "active", e.target.checked)
                      }
                      className="accent-blue w-4 h-4"
                    />
                    <span className="font-medium text-sm text-ink w-24">
                      {d.name}
                    </span>
                  </label>

                  {/* Delivery fee */}
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-xs text-gray-400">Fee:</span>
                    <div className="flex items-center">
                      <span className="text-xs text-gray-400 mr-1">Rs</span>
                      <input
                        type="number"
                        min={0}
                        value={edit.deliveryFee}
                        onChange={(e) =>
                          updateDistrictEdit(d.id, "deliveryFee", e.target.value)
                        }
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm font-grotesk focus:outline-none focus:border-blue"
                      />
                    </div>
                  </div>

                  {/* Estimated days */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">Days:</span>
                    <input
                      type="number"
                      min={1}
                      max={14}
                      value={edit.estimatedDays}
                      onChange={(e) =>
                        updateDistrictEdit(d.id, "estimatedDays", e.target.value)
                      }
                      className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm font-grotesk focus:outline-none focus:border-blue"
                    />
                  </div>

                  <button
                    onClick={() => saveDistrict(d.id)}
                    disabled={updateDistrict.isPending}
                    className="flex-shrink-0 flex items-center gap-1 text-xs text-blue border border-blue rounded-lg px-3 py-1.5 hover:bg-blue-pale disabled:opacity-50 transition-colors"
                  >
                    <Save size={12} />
                    Save
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Platform config */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-grotesk font-semibold text-base text-ink">
            Platform Configuration
          </h2>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateConfig.mutate(configForm);
          }}
          className="p-5 space-y-4"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                Company Name
              </label>
              <input
                value={configForm.companyName}
                onChange={(e) =>
                  setConfigForm((f) => ({ ...f, companyName: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                Support Phone
              </label>
              <input
                type="tel"
                value={configForm.supportPhone}
                onChange={(e) =>
                  setConfigForm((f) => ({ ...f, supportPhone: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                Company Address
              </label>
              <textarea
                rows={2}
                value={configForm.companyAddress}
                onChange={(e) =>
                  setConfigForm((f) => ({ ...f, companyAddress: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                Minimum Order Amount (Rs)
              </label>
              <input
                type="number"
                min={0}
                value={configForm.minOrderAmount}
                onChange={(e) =>
                  setConfigForm((f) => ({
                    ...f,
                    minOrderAmount: Number(e.target.value),
                  }))
                }
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                Support Email
              </label>
              <input
                type="email"
                value={configForm.supportEmail}
                onChange={(e) =>
                  setConfigForm((f) => ({ ...f, supportEmail: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
              />
            </div>
          </div>

          {configSaved && (
            <div className="flex items-center gap-2 text-green bg-green-light rounded-xl px-4 py-3 text-sm">
              <CheckCircle2 size={15} />
              Configuration saved successfully.
            </div>
          )}

          <button
            type="submit"
            disabled={updateConfig.isPending}
            className="flex items-center gap-2 bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm"
          >
            <Save size={15} />
            {updateConfig.isPending ? "Saving…" : "Save Configuration"}
          </button>
        </form>
      </section>
    </div>
  );
}
