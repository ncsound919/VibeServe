/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RAGContextData {
  indexedDocs: number;
  relevantSnippets: string[];
  lastSync: string;
}

export interface BrowserObservationData {
  url: string;
  viewport: { w: number; h: number };
  snapshotDescription: string;
  elementsFound: string[];
}

export interface BrowserHistoryItemData {
  id: string;
  timestamp: string;
  url: string;
  action: string;
  summary: string;
  type: 'navigation' | 'click' | 'input' | 'audit' | 'observation';
}
