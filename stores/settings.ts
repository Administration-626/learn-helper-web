import { create } from 'zustand';
import { LLMConfig } from '@/lib/types';
import { db, saveLLMConfig } from '@/lib/db';

interface SettingsState {
  configs: LLMConfig[];
  activeConfig: LLMConfig | null;
  
  loadConfigs: () => Promise<void>;
  addConfig: (config: Omit<LLMConfig, 'id'>) => Promise<void>;
  updateConfig: (config: LLMConfig) => Promise<void>;
  deleteConfig: (id: number) => Promise<void>;
  setActiveConfig: (id: number) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  configs: [],
  activeConfig: null,

  loadConfigs: async () => {
    const configs = await db.llmConfigs.toArray();
    const active = configs.find(c => c.isActive) || null;
    set({ configs, activeConfig: active });
  },

  addConfig: async (config) => {
    await saveLLMConfig(config as LLMConfig);
    await get().loadConfigs();
  },

  updateConfig: async (config) => {
    await saveLLMConfig(config);
    await get().loadConfigs();
  },

  deleteConfig: async (id) => {
    await db.llmConfigs.delete(id);
    await get().loadConfigs();
  },

  setActiveConfig: async (id) => {
    const { configs } = get();
    const configToActivate = configs.find(c => c.id === id);
    if (configToActivate) {
      await saveLLMConfig({ ...configToActivate, isActive: true });
      await get().loadConfigs();
    }
  }
}));
