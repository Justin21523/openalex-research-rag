#!/usr/bin/env python3
"""
Pre-warm all expensive API endpoints before a demo.
Run this once after the backend starts:

    python scripts/warmup_demo.py [--base-url http://localhost:8020]

All slow pages will then load from cache and feel instant.
"""

import argparse
import asyncio
import sys
import time

try:
    import httpx
except ImportError:
    print("Install httpx first:  pip install httpx")
    sys.exit(1)


DEMO_SEARCHES = [
    "transformer attention mechanism",
    "BERT language model",
    "graph neural network",
    "retrieval augmented generation",
    "federated learning privacy",
]

DEMO_RAG_QUERIES = [
    "What are recent advances in transformer attention mechanisms?",
    "Compare BERT and GPT approaches to language modeling",
    "What datasets are commonly used for graph neural networks?",
]

# Top concepts to pre-warm ResearchVelocity page
TOP_CONCEPTS_TO_WARM = [
    "Machine learning", "Deep learning", "Natural language processing",
    "Computer vision", "Reinforcement learning", "Transfer learning",
    "Knowledge graph", "Information retrieval", "Text classification",
    "Named entity recognition", "Question answering", "Neural network",
    "Convolutional neural network", "Recurrent neural network", "Attention mechanism",
    "BERT", "GPT", "Transformer", "Embedding", "Semantic similarity",
]


def ok(label: str, elapsed: float) -> None:
    print(f"  \033[32m✓\033[0m {label} ({elapsed:.1f}s)")


def warn(label: str, err: str) -> None:
    print(f"  \033[33m⚠\033[0m {label}: {err}")


async def warmup(base_url: str) -> None:
    print(f"\n\033[1mDemo Pre-Warm\033[0m → {base_url}\n")

    async with httpx.AsyncClient(base_url=base_url, timeout=120) as client:

        # ── 1. Health check ────────────────────────────────────────────────
        t = time.time()
        try:
            r = await client.get("/health")
            r.raise_for_status()
            d = r.json()
            ok(f"Health — {d.get('works_count', '?')} works, {d.get('chromadb_count', '?')} vectors", time.time() - t)
        except Exception as e:
            print(f"\n\033[31mERROR: Backend not reachable at {base_url}\033[0m")
            print(f"  {e}")
            print("  Start the backend first:  uvicorn src.api.main:app --port 8020")
            sys.exit(1)

        # ── 2. Top concepts (fills 1-hour cache) ──────────────────────────
        t = time.time()
        try:
            r = await client.get("/topics/concepts?limit=50")
            r.raise_for_status()
            ok(f"Concepts cache ({len(r.json())} concepts)", time.time() - t)
        except Exception as e:
            warn("Concepts", str(e))

        # ── 3. Heatmap ────────────────────────────────────────────────────
        t = time.time()
        try:
            r = await client.get("/topics/heatmap?top_n=15&year_from=2015&year_to=2024")
            r.raise_for_status()
            ok("Heatmap cache", time.time() - t)
        except Exception as e:
            warn("Heatmap", str(e))

        # ── 4. Journals (both sort orders) ────────────────────────────────
        t = time.time()
        try:
            await asyncio.gather(
                client.get("/topics/journals?limit=30&sort_by=paper_count"),
                client.get("/topics/journals?limit=30&sort_by=avg_citations"),
            )
            ok("Journals cache (both sort orders)", time.time() - t)
        except Exception as e:
            warn("Journals", str(e))

        # ── 5. Research Velocity: parallel trend queries ──────────────────
        print(f"\n  Warming ResearchVelocity ({len(TOP_CONCEPTS_TO_WARM)} concepts)…")
        t = time.time()
        tasks = [
            client.get(f"/topics/trends?concept={c}&year_from=2015&year_to=2024")
            for c in TOP_CONCEPTS_TO_WARM
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        failed = sum(1 for r in results if isinstance(r, Exception))
        ok(f"Velocity trends ({len(TOP_CONCEPTS_TO_WARM) - failed}/{len(TOP_CONCEPTS_TO_WARM)} ok)", time.time() - t)

        # ── 6. UMAP cluster (heaviest — ~15s) ────────────────────────────
        print("\n  Computing UMAP cluster (this takes ~15s)…")
        t = time.time()
        try:
            r = await client.get("/topics/cluster?top_n=3000", timeout=120)
            r.raise_for_status()
            d = r.json()
            ok(f"Cluster UMAP cache ({d.get('count', '?')} points, cached={d.get('cached', False)})", time.time() - t)
        except Exception as e:
            warn("Cluster UMAP", str(e))

        # ── 7. Paper searches (across all modes → richer analytics) ───────
        modes = ["hybrid", "bm25", "vector", "fts"]
        search_pairs = [(q, modes[i % len(modes)]) for i, q in enumerate(DEMO_SEARCHES)]
        # Run each query in hybrid too, so analytics has a clear mode distribution
        search_pairs += [(q, "hybrid") for q in DEMO_SEARCHES]
        print(f"\n  Running {len(search_pairs)} demo searches (mixed modes)…")
        t = time.time()
        tasks = [
            client.get(f"/search?q={q}&mode={m}&k=10")
            for q, m in search_pairs
        ]
        await asyncio.gather(*tasks, return_exceptions=True)
        ok(f"Demo searches ({len(search_pairs)} queries, {len(modes)} modes)", time.time() - t)

        # ── 8. RAG extractive answers → rag_cache ────────────────────────
        print(f"\n  Pre-running {len(DEMO_RAG_QUERIES)} RAG demo questions…")
        for q in DEMO_RAG_QUERIES:
            t = time.time()
            try:
                r = await client.post(
                    "/rag/answer",
                    json={"query": q, "use_extractive_fallback": True, "top_k": 5},
                    timeout=60,
                )
                r.raise_for_status()
                ok(f'RAG: "{q[:50]}…"', time.time() - t)
            except Exception as e:
                warn(f'RAG: "{q[:40]}"', str(e))

        # ── 8.5 Seed reading list + annotations (so those pages aren't empty) ──
        print("\n  Seeding reading list + annotations…")
        t = time.time()
        try:
            r = await client.get("/works/top?limit=10")
            r.raise_for_status()
            top_works = r.json()
            work_ids = [w["work_id"] for w in top_works]

            # Add ~8 popular papers to the reading list
            for wid in work_ids[:8]:
                try:
                    await client.post(f"/reading-list/{wid}")
                except Exception:
                    pass

            # Spread statuses so the donut chart has all three slices
            status_map = {
                0: "done", 1: "done", 2: "reading", 3: "reading", 4: "reading",
                # 5,6,7 stay "unread"
            }
            for idx, status in status_map.items():
                if idx < len(work_ids):
                    try:
                        await client.patch(f"/reading-list/{work_ids[idx]}?status={status}")
                    except Exception:
                        pass

            # Demo annotations on the top 3 papers
            demo_notes = [
                {"note_text": "Foundational paper — revisit the methodology section for the demo.",
                 "highlighted_text": "", "color": "yellow"},
                {"note_text": "Key baseline. Compare reported metrics against newer work.",
                 "highlighted_text": "", "color": "green"},
                {"note_text": "Useful related-work overview; cite in the literature review.",
                 "highlighted_text": "", "color": "blue"},
            ]
            for wid, note in zip(work_ids[:3], demo_notes):
                try:
                    await client.post(f"/works/{wid}/annotations", json=note)
                except Exception:
                    pass

            ok(f"Reading list ({min(8, len(work_ids))} papers) + annotations (3 notes)", time.time() - t)
        except Exception as e:
            warn("Reading list / annotations seed", str(e))

        # ── 9. Analytics summary ──────────────────────────────────────────
        t = time.time()
        try:
            r = await client.get("/analytics/summary")
            r.raise_for_status()
            d = r.json()
            ok(f"Analytics summary ({d.get('total_queries', 0)} queries logged)", time.time() - t)
        except Exception as e:
            warn("Analytics", str(e))

    print("\n\033[1;32m✓ Warmup complete! All pages should now load fast.\033[0m\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pre-warm demo endpoints")
    parser.add_argument("--base-url", default="http://localhost:8020", help="Backend URL")
    args = parser.parse_args()
    asyncio.run(warmup(args.base_url))
