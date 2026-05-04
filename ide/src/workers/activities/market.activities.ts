import { fetchMarketData, fetchRepoData, fetchNewsAndVideos } from '../../services/geminiService';

export interface MarketData {
  growthRate: number;
  activeDevelopers: number;
  totalModels: number;
  sentimentScore: number;
  predictions: unknown[];
  growthHistory: { month: string; value: number }[];
  signals: unknown[];
  synergyInsights: string[];
}

export interface RepoData {
  repos: unknown[];
  trendingTools: unknown[];
  openSourceStats: unknown[];
  harvestSources: unknown[];
}

export interface NewsData {
  news: unknown[];
  videos: unknown[];
}

export async function fetchMarketDataActivity(): Promise<MarketData> {
  return fetchMarketData() as Promise<MarketData>;
}

export async function fetchRepoDataActivity(): Promise<RepoData> {
  return fetchRepoData() as Promise<RepoData>;
}

export async function fetchNewsActivity(): Promise<NewsData> {
  return fetchNewsAndVideos() as Promise<NewsData>;
}
