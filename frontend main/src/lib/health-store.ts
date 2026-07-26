import { create } from 'zustand';
import { checkHealth } from '@/lib/api';

export type HealthStatus = 'operational' | 'degraded' | 'outage';

interface HealthState {
  status: HealthStatus;
  latency: number;
  lastChecked: string;
  checks: {
    github: boolean;
    ai: boolean;
    network: boolean;
    postgres: boolean;
    vectorai: boolean;
  };
  checkHealth: () => Promise<void>;
}

export const useHealthStore = create<HealthState>((set) => ({
  status: 'operational',
  latency: 45,
  lastChecked: new Date().toISOString(),
  checks: { github: true, ai: true, network: true, postgres: false, vectorai: false },
  
  checkHealth: async () => {
    const start = performance.now();
    let isGithubUp = true;
    let isNetworkUp = navigator.onLine;
    let isPostgresUp = false;
    let isVectoraiUp = false;

    // 1. Check GitHub API reachability
    try {
      await fetch('https://api.github.com/zen', { mode: 'no-cors' });
      isGithubUp = true;
    } catch {
      isGithubUp = false;
    }

    // 2. Check Express server health endpoint
    try {
      const health = await checkHealth();
      isPostgresUp = health.postgres === 'connected';
      isVectoraiUp = health.vectorai === 'connected';
    } catch {
      isPostgresUp = false;
      isVectoraiUp = false;
    }

    const end = performance.now();
    const duration = Math.round(end - start);

    let newStatus: HealthStatus = 'operational';
    if (!isNetworkUp || !isGithubUp) {
      newStatus = 'outage';
    } else if (!isPostgresUp || !isVectoraiUp || duration > 500) {
      newStatus = 'degraded';
    }

    set({
      status: newStatus,
      latency: duration,
      lastChecked: new Date().toISOString(),
      checks: {
        github: isGithubUp,
        ai: true, // Multi-provider AI (Gemini + OpenAI) — always true if network is up
        network: isNetworkUp,
        postgres: isPostgresUp,
        vectorai: isVectoraiUp,
      }
    });
  }
}));
