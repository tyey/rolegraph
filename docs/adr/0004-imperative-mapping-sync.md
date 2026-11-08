# Imperative SQLAlchemy mapping, synchronous all the way

Domain entities are plain dataclasses, with no SQLAlchemy or Pydantic imports. Each module's infrastructure declares Core `Table`s on one shared `MetaData` and maps the domain classes with `registry.map_imperatively()`. That gives the domain the ORM's unit of work and identity map while keeping it persistence-ignorant. Pydantic appears only in `api/`. The whole database path is **synchronous**: `def` endpoints in FastAPI's threadpool, `Session`, and the stdlib `sqlite3` driver. `async def` is kept for future edges that need it, such as LLM calls or streaming, and those call sync use cases through the threadpool.

## Considered Options

- **SQLModel** (the FastAPI tutorial's choice). Rejected: one class would be table, API schema and domain object at once, which fuses the layers DDD keeps apart, and SQLModel is still 0.0.x.
- **Separate declarative ORM models with to/from-domain mappers.** Rejected: every field is written twice, and change tracking across the mapping becomes our problem.
- **Async (`AsyncSession` + aiosqlite).** Rejected: aiosqlite is a thread per connection, so SQLite gains no concurrency. Async would spread `async` through every port, unit of work and use case, and it forbids lazy loading.

## Consequences

- Mapped entities can't use `__slots__` or be frozen dataclasses, because SQLAlchemy instruments them. Value objects (for example a Step's time) are frozen and mapped with `composite()` or custom types.
