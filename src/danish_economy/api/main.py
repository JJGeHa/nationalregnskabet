"""FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from danish_economy.api.routers import (
    finanslov,
    hello,
    institution,
    kommune,
    timeseries,
    transfer,
)

app = FastAPI(
    title="Danish Economy Explorer",
    description="API for Danish public-sector financial data",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(hello.router)
app.include_router(timeseries.router)
app.include_router(finanslov.router)
app.include_router(kommune.router)
app.include_router(institution.router)
app.include_router(transfer.router)
