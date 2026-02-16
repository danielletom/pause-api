/**
 * PubMed E-utilities API client.
 * Free REST API — 3 requests/sec without key, 10/sec with key.
 */

import { pubmed as config } from "../config";
import type { PubMedAbstract } from "../types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Search PubMed for articles matching a query.
 * Returns PMIDs (PubMed IDs).
 */
async function search(query: string, maxResults: number = config.maxResults): Promise<string[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmax: String(maxResults),
    sort: "relevance",
    retmode: "json",
  });
  if (config.apiKey) params.set("api_key", config.apiKey);

  const res = await fetch(`${config.baseUrl}/esearch.fcgi?${params}`);
  if (!res.ok) throw new Error(`PubMed search failed: ${res.status}`);

  const data = await res.json();
  return data.esearchresult?.idlist || [];
}

/**
 * Fetch abstracts for a list of PMIDs.
 */
async function fetchAbstracts(pmids: string[]): Promise<PubMedAbstract[]> {
  if (pmids.length === 0) return [];

  const params = new URLSearchParams({
    db: "pubmed",
    id: pmids.join(","),
    retmode: "json",
    rettype: "abstract",
  });
  if (config.apiKey) params.set("api_key", config.apiKey);

  const res = await fetch(`${config.baseUrl}/esummary.fcgi?${params}`);
  if (!res.ok) throw new Error(`PubMed fetch failed: ${res.status}`);

  const data = await res.json();
  const results: PubMedAbstract[] = [];

  for (const pmid of pmids) {
    const item = data.result?.[pmid];
    if (!item) continue;

    results.push({
      pmid,
      title: item.title || "",
      abstract: "", // eSummary doesn't include full abstract — we'll fetch separately
      authors: (item.authors || []).map((a: { name: string }) => a.name),
      journal: item.fulljournalname || item.source || "",
      year: parseInt(item.pubdate?.split(" ")[0]) || 0,
    });
  }

  return results;
}

/**
 * Fetch full abstracts via eFetch (XML).
 */
async function fetchFullAbstracts(pmids: string[]): Promise<Map<string, string>> {
  if (pmids.length === 0) return new Map();

  const params = new URLSearchParams({
    db: "pubmed",
    id: pmids.join(","),
    retmode: "xml",
    rettype: "abstract",
  });
  if (config.apiKey) params.set("api_key", config.apiKey);

  const res = await fetch(`${config.baseUrl}/efetch.fcgi?${params}`);
  if (!res.ok) throw new Error(`PubMed eFetch failed: ${res.status}`);

  const xml = await res.text();
  const abstractMap = new Map<string, string>();

  // Simple XML parsing for abstracts — extract <AbstractText> blocks per PMID
  const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g;
  let match;
  while ((match = articleRegex.exec(xml)) !== null) {
    const article = match[1];
    const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    const abstractTexts: string[] = [];

    const absRegex = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g;
    let absMatch;
    while ((absMatch = absRegex.exec(article)) !== null) {
      abstractTexts.push(absMatch[1].replace(/<[^>]+>/g, "").trim());
    }

    if (pmidMatch && abstractTexts.length > 0) {
      abstractMap.set(pmidMatch[1], abstractTexts.join(" "));
    }
  }

  return abstractMap;
}

/**
 * Search PubMed and return articles with full abstracts.
 */
export async function searchPubMed(
  query: string,
  maxResults: number = config.maxResults
): Promise<PubMedAbstract[]> {
  // Step 1: Search for PMIDs
  const pmids = await search(query, maxResults);
  if (pmids.length === 0) return [];

  // Rate limit: wait 350ms between calls (safe for 3/sec)
  await delay(350);

  // Step 2: Get summaries (metadata)
  const summaries = await fetchAbstracts(pmids);

  await delay(350);

  // Step 3: Get full abstracts
  const fullAbstracts = await fetchFullAbstracts(pmids);

  // Merge
  for (const summary of summaries) {
    summary.abstract = fullAbstracts.get(summary.pmid) || "";
  }

  return summaries;
}

/**
 * Get the search query for a content category.
 */
export function getSearchQuery(category: string, additionalTerms?: string): string {
  const baseQuery = config.searchTerms[category] || config.searchTerms["Basics"];
  if (additionalTerms) {
    return `${baseQuery} AND (${additionalTerms})`;
  }
  return baseQuery;
}
