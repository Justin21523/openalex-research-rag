"""CLI evaluation runner — search metrics and RAG grounding check."""

import json
import time

from src.evaluation.metrics import mean_latency, mrr_at_k, ndcg_at_k, recall_at_k
from src.evaluation.test_queries import TEST_QUERIES
from src.features.bm25_index import BM25Index
from src.features.embeddings import WorkEmbedder
from src.models.rag_pipeline import RAGPipeline
from src.retrieval.hybrid_search import HybridSearch
from src.retrieval.vector_store import VectorStore
from src.utils.config import get_settings
from src.utils.db import get_connection
from src.utils.logging import get_logger, setup_logging
from src.utils.paths import EVALUATION_RESULTS_PATH

logger = get_logger(__name__)
_K_LIST = [1, 5, 10]
_MODES = ["bm25", "vector", "hybrid"]


def run_search_evaluation(
    search: HybridSearch,
    queries: list[dict] | None = None,
) -> dict:
    queries = queries or TEST_QUERIES
    queries_with_relevant = [q for q in queries if q["relevant_work_ids"]]

    per_query = []
    mode_latencies: dict[str, list[float]] = {m: [] for m in _MODES}
    mode_scores: dict[str, dict[str, list[float]]] = {
        m: {f"{metric}@{k}": [] for m in _MODES for k in _K_LIST for metric in ("recall", "mrr", "ndcg")}
        for m in _MODES
    }

    for q in queries_with_relevant:
        query = q["query"]
        relevant = q["relevant_work_ids"]
        row: dict = {"query": query}

        for mode in _MODES:
            t0 = time.time()
            hits = search.search(query, k=max(_K_LIST), mode=mode)
            lat = (time.time() - t0) * 1000
            mode_latencies[mode].append(lat)

            retrieved = [h["work_id"] for h in hits]
            for k in _K_LIST:
                mode_scores[mode][f"recall@{k}"].append(recall_at_k(retrieved, relevant, k))
                mode_scores[mode][f"mrr@{k}"].append(mrr_at_k(retrieved, relevant, k))
                mode_scores[mode][f"ndcg@{k}"].append(ndcg_at_k(retrieved, relevant, k))
            row[mode] = {"retrieved": retrieved[:5], "latency_ms": round(lat, 2)}

        per_query.append(row)

    summary: dict = {}
    for mode in _MODES:
        p50, p99 = mean_latency(mode_latencies[mode])
        summary[mode] = {
            f"recall@{k}": round(
                sum(mode_scores[mode][f"recall@{k}"]) / max(len(mode_scores[mode][f"recall@{k}"]), 1), 3
            )
            for k in _K_LIST
        }
        summary[mode].update({
            f"mrr@{k}": round(
                sum(mode_scores[mode][f"mrr@{k}"]) / max(len(mode_scores[mode][f"mrr@{k}"]), 1), 3
            )
            for k in _K_LIST
        })
        summary[mode].update({
            f"ndcg@{k}": round(
                sum(mode_scores[mode][f"ndcg@{k}"]) / max(len(mode_scores[mode][f"ndcg@{k}"]), 1), 3
            )
            for k in _K_LIST
        })
        summary[mode]["latency_p50_ms"] = round(p50, 2)
        summary[mode]["latency_p99_ms"] = round(p99, 2)

    return {"per_query": per_query, "summary": summary}


def run_rag_evaluation(rag: RAGPipeline, queries: list[dict] | None = None) -> dict:
    queries = queries or TEST_QUERIES
    results = []
    for q in queries:
        t0 = time.time()
        answer = rag.answer_extractive(q["query"])
        latency = (time.time() - t0) * 1000
        results.append({
            "query": q["query"],
            "citations_found": len(answer.citations),
            "evidence_count": len(answer.evidence_works),
            "grounded": len(answer.citations) > 0,
            "latency_ms": round(latency, 2),
        })
    return {
        "rag_results": results,
        "grounding_rate": sum(1 for r in results if r["grounded"]) / max(len(results), 1),
        "avg_citations": sum(r["citations_found"] for r in results) / max(len(results), 1),
    }


def _print_table(summary: dict) -> None:
    header = f"{'Mode':<10} " + " ".join(f"R@{k:<4} MRR@{k:<4} nDCG@{k:<5}" for k in _K_LIST) + " P50ms  P99ms"
    print("\n" + header)
    print("-" * len(header))
    for mode in _MODES:
        m = summary[mode]
        row = f"{mode:<10} "
        row += " ".join(
            f"{m[f'recall@{k}']:.3f} {m[f'mrr@{k}']:.3f}  {m[f'ndcg@{k}']:.3f}  " for k in _K_LIST
        )
        row += f" {m['latency_p50_ms']:.1f}   {m['latency_p99_ms']:.1f}"
        print(row)
    print()


if __name__ == "__main__":
    setup_logging()
    settings = get_settings()
    conn = get_connection()

    bm25 = BM25Index().load()
    vs = VectorStore(settings.chroma_dir)
    embedder = WorkEmbedder(settings.embeddings_model)
    search = HybridSearch(bm25, vs, embedder, rrf_k=settings.rrf_k)
    rag = RAGPipeline(search, conn)

    logger.info("Running search evaluation …")
    search_results = run_search_evaluation(search)
    _print_table(search_results["summary"])

    logger.info("Running RAG grounding evaluation …")
    rag_results = run_rag_evaluation(rag)
    print(f"RAG grounding rate: {rag_results['grounding_rate']:.0%}")
    print(f"Avg citations/answer: {rag_results['avg_citations']:.1f}")

    output = {"search": search_results, "rag": rag_results}
    EVALUATION_RESULTS_PATH.parent.mkdir(exist_ok=True)
    EVALUATION_RESULTS_PATH.write_text(json.dumps(output, indent=2))
    logger.info("Results saved → %s", EVALUATION_RESULTS_PATH)
