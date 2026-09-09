import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import data, descriptive, inference, graphical, hypothesis, probability
from sessions.store import clean_expired_sessions


@asynccontextmanager
async def lifespan(app: FastAPI):
    async def cleanup_loop():
        while True:
            await asyncio.sleep(300)  # 5 minutes
            clean_expired_sessions()

    task = asyncio.create_task(cleanup_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="ThotsakanStatistics API", lifespan=lifespan)

# Configure CORS for Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data.router, prefix="/api/data", tags=["data"])
app.include_router(descriptive.router, prefix="/api/descriptive", tags=["descriptive"])
app.include_router(inference.router) # inference router defines its own prefix /api/inference
app.include_router(graphical.router) # graphical router defines its own prefix /api/graphical
app.include_router(hypothesis.router) # hypothesis router defines its own prefix /api/hypothesis
app.include_router(probability.router, prefix="/api/probability", tags=["probability"])

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
