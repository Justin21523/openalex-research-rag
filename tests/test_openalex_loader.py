"""Tests for ingestion schema, text cleaning, normalisation, and sample loading."""

import json

import pytest

from src.ingestion.sample_loader import load_works_sample
from src.preprocessing.deduplicator import deduplicate_by_doi, deduplicate_works
from src.preprocessing.normalizer import extract_entity_id, normalize_work
from src.preprocessing.text_cleaner import (
    build_searchable_text,
    clean_for_bm25,
    reconstruct_abstract,
)


# ── reconstruct_abstract ───────────────────────────────────────────────────────

def test_reconstruct_abstract_correct_word_order():
    inv = {"machine": [0], "learning": [1, 3], "deep": [2]}
    result = reconstruct_abstract(inv)
    assert result == "machine learning deep learning"


def test_reconstruct_abstract_handles_none():
    assert reconstruct_abstract(None) == ""


def test_reconstruct_abstract_handles_empty_dict():
    assert reconstruct_abstract({}) == ""


def test_reconstruct_abstract_single_word():
    assert reconstruct_abstract({"hello": [0]}) == "hello"


def test_reconstruct_abstract_gaps_produce_empty_tokens():
    inv = {"first": [0], "third": [2]}
    result = reconstruct_abstract(inv)
    assert "first" in result and "third" in result


# ── extract_entity_id ──────────────────────────────────────────────────────────

def test_extract_entity_id_from_full_url():
    assert extract_entity_id("https://openalex.org/W2741809807") == "W2741809807"


def test_extract_entity_id_short_form_passthrough():
    assert extract_entity_id("W2741809807") == "W2741809807"


def test_extract_entity_id_author():
    assert extract_entity_id("https://openalex.org/A123456") == "A123456"


def test_extract_entity_id_none_returns_empty():
    assert extract_entity_id(None) == ""


# ── normalize_work ─────────────────────────────────────────────────────────────

def test_normalize_work_reconstructs_abstract():
    raw = {
        "id": "https://openalex.org/W1",
        "title": "Test Title",
        "abstract_inverted_index": {"hello": [0], "world": [1]},
        "publication_year": 2021,
        "cited_by_count": 10,
    }
    result = normalize_work(raw)
    assert result["abstract"] == "hello world"
    assert result["work_id"] == "W1"


def test_normalize_work_flattens_concepts_to_json():
    raw = {
        "id": "https://openalex.org/W2",
        "concepts": [{"id": "C1", "display_name": "AI"}],
    }
    result = normalize_work(raw)
    concepts = json.loads(result["concepts_json"])
    assert isinstance(concepts, list)
    assert concepts[0]["display_name"] == "AI"


def test_normalize_work_extracts_short_referenced_work_ids():
    raw = {
        "id": "https://openalex.org/W3",
        "referenced_works": ["https://openalex.org/W100", "https://openalex.org/W200"],
    }
    result = normalize_work(raw)
    refs = json.loads(result["referenced_works_json"])
    assert "W100" in refs and "W200" in refs


def test_normalize_work_handles_missing_abstract():
    raw = {"id": "https://openalex.org/W4"}
    result = normalize_work(raw)
    assert result["abstract"] == ""


# ── deduplicator ──────────────────────────────────────────────────────────────

def test_deduplicate_works_removes_duplicate_ids():
    works = [
        {"work_id": "W1", "title": "First"},
        {"work_id": "W1", "title": "Duplicate"},
        {"work_id": "W2", "title": "Unique"},
    ]
    result = deduplicate_works(works)
    assert len(result) == 2
    assert {w["work_id"] for w in result} == {"W1", "W2"}


def test_deduplicate_by_doi_removes_same_doi():
    works = [
        {"work_id": "W1", "doi": "10.1/test"},
        {"work_id": "W2", "doi": "10.1/test"},
        {"work_id": "W3", "doi": "10.1/other"},
    ]
    result = deduplicate_by_doi(works)
    assert len(result) == 2


def test_deduplicate_by_doi_keeps_none_doi():
    works = [
        {"work_id": "W1", "doi": None},
        {"work_id": "W2", "doi": None},
    ]
    result = deduplicate_by_doi(works)
    assert len(result) == 2


# ── sample loader ─────────────────────────────────────────────────────────────

def test_load_works_sample_returns_list():
    works = load_works_sample()
    assert isinstance(works, list)
    assert len(works) > 0


def test_load_works_sample_has_expected_fields():
    works = load_works_sample()
    w = works[0]
    assert "id" in w or "work_id" in w


# ── text cleaner ──────────────────────────────────────────────────────────────

def test_clean_for_bm25_lowercases():
    assert clean_for_bm25("HELLO World") == "hello world"


def test_build_searchable_text_repeats_title():
    text = build_searchable_text("Transformers", "abstract here")
    assert text.count("Transformers") == 2
