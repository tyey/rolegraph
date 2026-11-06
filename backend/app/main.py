from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.middleware.cors import CORSMiddleware



def _operation_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}" if route.tags else route.name


app = FastAPI(title="rolegraph", version="0.1.0", generate_unique_id_function=_operation_id)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


from app.spike_routes import router as spike_router  # noqa: E402

app.include_router(spike_router)
