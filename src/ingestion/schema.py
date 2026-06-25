"""Pydantic v2 models for raw OpenAlex API responses."""

from pydantic import BaseModel, ConfigDict, Field


class OpenAlexWork(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str | None = None
    display_name: str | None = None
    abstract_inverted_index: dict[str, list[int]] | None = None
    publication_year: int | None = None
    cited_by_count: int = 0
    doi: str | None = None
    primary_location: dict | None = None
    concepts: list[dict] = Field(default_factory=list)
    authorships: list[dict] = Field(default_factory=list)
    referenced_works: list[str] = Field(default_factory=list)
    language: str | None = None
    type: str | None = None


class OpenAlexAuthor(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    display_name: str | None = None
    works_count: int = 0
    cited_by_count: int = 0
    last_known_institution: dict | None = None
    x_concepts: list[dict] = Field(default_factory=list)


class OpenAlexInstitution(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    display_name: str | None = None
    country_code: str | None = None
    type: str | None = None
    works_count: int = 0
    cited_by_count: int = 0


class OpenAlexPage(BaseModel):
    """Paginated API response envelope."""

    meta: dict
    results: list[dict]
