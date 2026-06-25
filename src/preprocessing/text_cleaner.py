"""Text cleaning utilities including OpenAlex abstract reconstruction."""

import re
import unicodedata


def reconstruct_abstract(inverted_index: dict[str, list[int]] | None) -> str:
    """Reconstruct plain-text abstract from OpenAlex inverted index format.

    OpenAlex stores abstracts as {word: [position, ...]} dicts to avoid
    scraping restrictions. This rebuilds the original word order.
    """
    if not inverted_index:
        return ""
    try:
        max_pos = max(pos for positions in inverted_index.values() for pos in positions)
    except ValueError:
        return ""
    words: list[str] = [""] * (max_pos + 1)
    for word, positions in inverted_index.items():
        for pos in positions:
            if 0 <= pos <= max_pos:
                words[pos] = word
    return " ".join(w for w in words if w)


def clean_text(text: str, max_chars: int = 4000) -> str:
    """Strip HTML tags, normalize unicode, collapse whitespace."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_chars]


def clean_for_bm25(text: str) -> str:
    """Lowercase and remove punctuation for BM25 tokenisation."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def build_searchable_text(title: str, abstract: str) -> str:
    """Combine title (repeated for weight) and abstract into one search string."""
    title = title or ""
    abstract = abstract or ""
    return f"{title} {title} {abstract}".strip()
