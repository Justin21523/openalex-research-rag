# Citation Policy

## Data Source

OpenAlex data is licensed under **CC0 1.0 Universal** (public domain dedication).
See: https://docs.openalex.org/license

This means:
- No restrictions on use, including commercial use
- No attribution required (though we attribute by convention)
- Safe for portfolio, research, and production use

## What We Store

- Work metadata (title, abstract, year, DOI, concepts, authorships)
- Citation edges (citing_work_id → cited_work_id) derived from `referenced_works`
- We do NOT store full paper PDFs or copyrighted article text

## Sample Data Policy

- `data/sample/works_sample.json` contains ~195 real work records fetched from OpenAlex
- These records are CC0 and safe to commit to a public repository
- Abstracts are reconstructed from OpenAlex inverted indexes (not scraped from publisher sites)
- **We do not redistribute raw publisher PDFs or full-text articles**

## RAG Answer Policy

- RAG answers are generated from abstract snippets only
- Every LLM answer must cite source work IDs — no uncited claims allowed
- Extractive fallback mode returns verbatim abstract sentences with citation attribution

## Notice

*This project is for research and portfolio demonstration purposes.
OpenAlex data is used under the CC0 license.
No original publisher PDFs or licensed full-text content is stored or redistributed.*
