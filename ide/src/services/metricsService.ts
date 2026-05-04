import { GHRepo } from './githubService';

export async function fetchLiveMetrics(repoNames: string[]) {
  if (repoNames.length === 0) return { cpu: 0, memory: 0, disk: 0, network: 0 };
  // Mocking real metrics fetch for now as requested
  return { cpu: 25, memory: 40, disk: 15, network: 120 };
}
