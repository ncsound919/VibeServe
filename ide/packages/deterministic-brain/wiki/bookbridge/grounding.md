---
title: BookBridge Grounding
tags: [bookbridge, grounding, citations, books]
namespace: bookbridge
sources:
  - bookbridge: n/a
aliases: [grounding, book library, citations]
---
# BookBridge Grounding

The 133-book library (FastAPI on `http://127.0.0.1:8777`) grounds agent
reasoning in verified passages.

- `POST /search` — hybrid search over chunks; returns `book_title`, `authors`,
  `score`, `section_heading`.
- `POST /reading_plan` — plan for a topic across up to 5 books.
- `POST /citation` — APA/MLA citation for a book id.
- Draymond client: `src/lib/bookbridge.ts` (`groundWithBooks`, `searchBooks`).
