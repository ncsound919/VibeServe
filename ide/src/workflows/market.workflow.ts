import { proxyActivities } from '@temporalio/workflow';
import type * as marketActivities from '../workers/activities/market.activities';

const activityOptions = {
  startToCloseTimeout: '2 minutes' as const,
  retry: {
    maximumAttempts: 3,
    initialInterval: '5 seconds' as const,
    backoffCoefficient: 2,
  },
};

const { fetchMarketDataActivity, fetchRepoDataActivity, fetchNewsActivity } = proxyActivities<typeof marketActivities>(activityOptions);

export interface DashboardDataResult {
  market: Awaited<ReturnType<typeof fetchMarketDataActivity>>;
  repos: Awaited<ReturnType<typeof fetchRepoDataActivity>>;
  news: Awaited<ReturnType<typeof fetchNewsActivity>>;
}

export async function fetchDashboardWorkflow(): Promise<DashboardDataResult> {
  const [market, repos, news] = await Promise.all([
    fetchMarketDataActivity(),
    fetchRepoDataActivity(),
    fetchNewsActivity(),
  ]);
  return { market, repos, news };
}
