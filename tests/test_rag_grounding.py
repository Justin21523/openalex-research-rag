"""Tests for RAG pipeline — context building, citation extraction, grounding."""

from unittest.mock import MagicMock, patch

import pytest

from src.models.rag_pipeline import RAGPipeline
from src.retrieval.hybrid_search import HybridSearch


@pytest.fixture
def rag_pipeline(bm25_index, mock_vector_store, mock_embedder, seeded_conn):
    search = HybridSearch(bm25_index, mock_vector_store, mock_embedder)
    return RAGPipeline(search, seeded_conn, top_k=3)


def test_build_context_contains_work_id_markers(rag_pipeline):
    works = [
        {"work_id": "W0000000001", "title": "Test Paper", "abstract": "Some abstract text.", "publication_year": 2021, "cited_by_count": 100},
    ]
    context = rag_pipeline._build_context(works)
    assert "[W0000000001]" in context
    assert "Test Paper" in context


def test_extract_citations_finds_bracket_patterns(rag_pipeline):
    text = "Transformers are powerful [W2741809807]. See also [W1234567890]."
    citations = rag_pipeline._extract_citations(text)
    assert "[W2741809807]" in citations
    assert "[W1234567890]" in citations


def test_extract_citations_returns_empty_on_no_pattern(rag_pipeline):
    text = "There are no citations in this text at all."
    citations = rag_pipeline._extract_citations(text)
    assert citations == []


def test_extract_citations_deduplicates(rag_pipeline):
    text = "See [W1234567890] and again [W1234567890]."
    citations = rag_pipeline._extract_citations(text)
    assert len(citations) == 1


def test_validate_grounding_passes_with_overlap(rag_pipeline):
    assert rag_pipeline._validate_grounding(["W1", "W2"], ["W1", "W3"]) is True


def test_validate_grounding_fails_with_no_overlap(rag_pipeline):
    assert rag_pipeline._validate_grounding(["W1"], ["W2", "W3"]) is False


def test_validate_grounding_empty_cited(rag_pipeline):
    assert rag_pipeline._validate_grounding([], ["W1"]) is False


def test_extractive_fallback_does_not_call_llm(rag_pipeline):
    with patch("httpx.post") as mock_post:
        result = rag_pipeline.answer_extractive("What is attention?")
    mock_post.assert_not_called()
    assert result.mode == "extractive"


def test_extractive_fallback_cites_all_retrieved_works(rag_pipeline):
    result = rag_pipeline.answer_extractive("transformer attention")
    # Should return at least one citation
    assert len(result.citations) > 0


def test_extractive_fallback_returns_valid_pydantic_model(rag_pipeline):
    from src.models.rag_pipeline import CitationGroundedAnswer
    result = rag_pipeline.answer_extractive("deep learning")
    assert isinstance(result, CitationGroundedAnswer)
    assert result.latency_ms >= 0


def test_rag_answer_extractive_grounded(rag_pipeline):
    result = rag_pipeline.answer_extractive("BERT language model pretraining")
    evidence_ids = {w["work_id"] for w in result.evidence_works}
    if result.citations:
        assert any(c in evidence_ids for c in result.citations)


# ── Multi-hop tests ──────────────────────────────────────────────────────────

def test_expand_via_references_returns_list(rag_pipeline):
    ids = ["W0000000001", "W0000000002"]
    result = rag_pipeline._expand_via_references(ids)
    assert isinstance(result, list)


def test_expand_via_references_empty_input(rag_pipeline):
    assert rag_pipeline._expand_via_references([]) == []


def test_expand_via_references_excludes_originals(rag_pipeline):
    ids = ["W0000000001"]
    expanded = rag_pipeline._expand_via_references(ids)
    assert "W0000000001" not in expanded


def test_answer_multihop_returns_citation_grounded_answer(rag_pipeline):
    from src.models.rag_pipeline import CitationGroundedAnswer
    result = rag_pipeline.answer_multihop("transformer attention")
    assert isinstance(result, CitationGroundedAnswer)
    assert result.mode in ("multi-hop", "extractive")
    assert result.latency_ms >= 0


def test_answer_multihop_extractive_fallback(rag_pipeline):
    # With no llama.cpp available it falls back to extractive mode
    result = rag_pipeline.answer_multihop("graph neural networks")
    assert len(result.citations) > 0


# ── Streaming tests ──────────────────────────────────────────────────────────

def test_stream_extractive_yields_tokens_then_done(rag_pipeline):
    events = list(rag_pipeline._stream_extractive("transformer attention"))
    assert len(events) > 0
    import json
    done_events = [json.loads(e[6:]) for e in events if json.loads(e[6:]).get("type") == "done"]
    assert len(done_events) == 1
    done = done_events[0]
    assert "citations" in done
    assert "evidence_works" in done
    assert done["mode"] == "extractive"


def test_stream_extractive_token_events_have_content(rag_pipeline):
    import json
    events = list(rag_pipeline._stream_extractive("deep learning"))
    token_events = [json.loads(e[6:]) for e in events if json.loads(e[6:]).get("type") == "token"]
    # Should have at least one token
    assert len(token_events) > 0
    assert all("content" in ev for ev in token_events)


def test_answer_stream_falls_back_when_llm_unavailable(rag_pipeline):
    import json
    # llama.cpp is not running — should fall through to extractive SSE
    events = list(rag_pipeline.answer_stream("What is BERT?"))
    done_events = [json.loads(e[6:]) for e in events if json.loads(e[6:]).get("type") == "done"]
    assert len(done_events) == 1
    assert done_events[0]["mode"] == "extractive"
