# Data Card

## Dataset: OpenAlex Works Sample

| Field | Value |
|-------|-------|
| Source | OpenAlex API (https://api.openalex.org) |
| License | CC0 1.0 Universal (Public Domain) |
| Sample size | ~195 works with full abstracts |
| Languages | English (filtered via `language:en`) |
| Date fetched | 2026-06-24 |
| Topics covered | Transformers, BERT, GNNs, RAG, citation networks, IR, embeddings, NLP |

## Schema

### works table
| Column | Type | Description |
|--------|------|-------------|
| work_id | VARCHAR PK | Short OpenAlex ID (e.g. W2741809807) |
| title | VARCHAR | Paper title |
| abstract | TEXT | Reconstructed from inverted index |
| publication_year | INTEGER | Year published |
| cited_by_count | INTEGER | Total citations (OpenAlex) |
| doi | VARCHAR | DOI if available |
| primary_location_name | VARCHAR | Journal/venue name |
| concepts_json | JSON | List of concept dicts with scores |
| authorships_json | JSON | Author + institution list |
| referenced_works_json | JSON | List of cited short work IDs |
| language | VARCHAR | ISO 639-1 code |
| type | VARCHAR | article / preprint / etc. |

### citations table
| Column | Type |
|--------|------|
| citing_work_id | VARCHAR |
| cited_work_id | VARCHAR |

## Limitations
- Sample of 195 works — not representative of all research
- Abstracts reconstructed from inverted indexes (may have minor whitespace artifacts)
- Referenced works only link to other works in the corpus (13k+ citation rows but most cited works are not in the 195-work corpus)
- OpenAlex concept scores are model-assigned, not human-verified
