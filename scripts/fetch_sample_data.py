"""One-time script to fetch sample data from OpenAlex and save to data/sample/.
Run with: python scripts/fetch_sample_data.py
"""

import json
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_DIR = ROOT / "data" / "sample"
SAMPLE_DIR.mkdir(parents=True, exist_ok=True)

BASE = "https://api.openalex.org"
HEADERS = {"User-Agent": "openalex-research-rag/0.1 (portfolio project)"}

TOPICS = [
    "transformer attention mechanism deep learning",
    "BERT language model pretraining",
    "graph neural networks knowledge graph",
    "retrieval augmented generation RAG",
    "citation network scholarly analysis",
    "information retrieval BM25",
    "sentence embeddings semantic search",
    "scientific text mining NLP",
    "topic modeling LDA",
    "academic knowledge base entity linking",
]


def fetch_page(query: str, per_page: int = 25) -> list[dict]:
    params = {
        "search": query,
        "per-page": per_page,
        "filter": "has_abstract:true,language:en",
        "select": ",".join([
            "id", "title", "display_name", "abstract_inverted_index",
            "publication_year", "cited_by_count", "doi", "primary_location",
            "concepts", "authorships", "referenced_works", "language", "type",
        ]),
    }
    try:
        time.sleep(0.15)
        r = httpx.get(f"{BASE}/works", params=params, headers=HEADERS, timeout=30)
        r.raise_for_status()
        return r.json().get("results", [])
    except Exception as e:
        print(f"  Warning: {e}", file=sys.stderr)
        return []


def fetch_authors(work_ids: list[str]) -> list[dict]:
    author_ids: set[str] = set()
    for wid in work_ids[:20]:
        try:
            time.sleep(0.15)
            r = httpx.get(f"{BASE}/works/{wid}", headers=HEADERS, timeout=30)
            if r.status_code == 200:
                for auth in r.json().get("authorships", []):
                    aid = auth.get("author", {}).get("id", "")
                    if aid:
                        author_ids.add(aid.split("/")[-1])
        except Exception:
            pass
    authors = []
    for aid in list(author_ids)[:30]:
        try:
            time.sleep(0.15)
            r = httpx.get(f"{BASE}/authors/{aid}", headers=HEADERS, timeout=30)
            if r.status_code == 200:
                authors.append(r.json())
        except Exception:
            pass
    return authors


def fetch_institutions(author_data: list[dict]) -> list[dict]:
    inst_ids: set[str] = set()
    for a in author_data:
        inst = a.get("last_known_institution") or {}
        iid = inst.get("id", "")
        if iid:
            inst_ids.add(iid.split("/")[-1])
    institutions = []
    for iid in list(inst_ids)[:20]:
        try:
            time.sleep(0.15)
            r = httpx.get(f"{BASE}/institutions/{iid}", headers=HEADERS, timeout=30)
            if r.status_code == 200:
                institutions.append(r.json())
        except Exception:
            pass
    return institutions


def main() -> None:
    print("Fetching works …")
    all_works: dict[str, dict] = {}
    for topic in TOPICS:
        print(f"  → {topic}")
        results = fetch_page(topic, per_page=20)
        for w in results:
            wid = w.get("id", "").split("/")[-1]
            if wid and w.get("abstract_inverted_index"):
                all_works[wid] = w
        if len(all_works) >= 200:
            break

    works_list = list(all_works.values())[:200]
    print(f"  Total works with abstracts: {len(works_list)}")

    (SAMPLE_DIR / "works_sample.json").write_text(
        json.dumps(works_list, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Saved {len(works_list)} works → data/sample/works_sample.json")

    print("Fetching authors …")
    work_short_ids = [w["id"].split("/")[-1] for w in works_list[:20]]
    authors = fetch_authors(work_short_ids)
    (SAMPLE_DIR / "authors_sample.json").write_text(
        json.dumps(authors, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Saved {len(authors)} authors → data/sample/authors_sample.json")

    print("Fetching institutions …")
    institutions = fetch_institutions(authors)
    (SAMPLE_DIR / "institutions_sample.json").write_text(
        json.dumps(institutions, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Saved {len(institutions)} institutions → data/sample/institutions_sample.json")
    print("Done.")


if __name__ == "__main__":
    main()
