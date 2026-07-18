<!-- i18n: language-switcher -->
[English](README.en.md) | [日本語](README.md)

# Daimon Docs

This directory serves as the definitive guide to understanding Daimon by breaking down "what we are making," "why it takes this form," and "how it operates."

The top-level `README.md` covers how to start and the overall picture, while the `docs/` folder discusses design philosophy, UX, implementation structure, and future decision-making.

## Recommended Reading Order

| Document | Role |
| --- | --- |
| [DAIMON_PROJECT_DESCRIPTION.txt](DAIMON_PROJECT_DESCRIPTION.txt) | A detailed brief of the entire project. Suitable for interviews, explanations, and organizing ideas. |
| [PRODUCT_AND_UX.md](PRODUCT_AND_UX.md) | Product design centered on POV, sense-distance exploration, and intrinsic reward UI — the definitive guide. |
| [THEORY_TO_FEATURES.md](THEORY_TO_FEATURES.md) | A mapping from theory to features. The decision-making axis for what to build. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Current implementation structure. Responsibilities of Go API, ML service, PostgreSQL, Qdrant, Redis. |
| [ROADMAP.md](ROADMAP.md) | What is being built now, what will be built next, and what is not being built yet. |
| [CONTENT_MODERATION.md](CONTENT_MODERATION.md) | Safe design for POV comments, spoilers, reports, and potentially contentious discussions. |
| [CONCEPT_AND_RESEARCH.txt](CONCEPT_AND_RESEARCH.txt) | Concise notes on research, reference services, and theories. Background material rather than product specs. |
| [RESEARCH.md](RESEARCH.md) | The **comprehensive dossier (arsenal)** of research and theories. Annotated list of papers, design-science correspondence, neuroscience/psychology, latest research (2024–), successful services. For deep interview exploration. |

Light, compatible indexes:

- [FEATURES.txt](FEATURES.txt): List of features consolidated in [ROADMAP.md](ROADMAP.md).
- [SPEC.txt](SPEC.txt): Theory-based specifications consolidated in [THEORY_TO_FEATURES.md](THEORY_TO_FEATURES.md).

## Daimon in One Sentence

Daimon is a social network that focuses on "points of view (POV)" as units of conversation, allowing people who see the same thing but feel differently to casually connect.

## Current MVP

The current implementation aims to deliver the following experience:

1. Users post content and attach POVs.
2. The post content is embedded and made searchable via meaning search in Qdrant.
3. Posts, POVs, comments, follows, and saves are stored as the canonical data in PostgreSQL.
4. The timeline mixes not only similar meaning posts but also distant posts sharing a common POV.
5. On the POV page, users can view comments and related posts about that perspective.

The core features still under development are `post_pov_assertions` and sense-distance exploration. While `povs: string[]` is useful as an entry point, to truly embody Daimon’s essence, we need to store assertions like "What if I see this post from this perspective?"

## Canon and Local Notes

`docs/*.md` and `docs/*.txt` are shared documents.

`docs/*.local.md` are local, detailed notes ignored by Git. They can include environment-specific experiments, tentative designs, and lengthy implementation readings. When reflecting changes into shared documents, only transfer the decision points briefly.