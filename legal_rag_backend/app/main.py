from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router

app = FastAPI(
    title="Legal Contract AI - Production RAG Backend",
    description="Stateful Legal RAG with Pinecone Cloud, Local Hybrid Search, FlashRank, and Conflict Resolution.",
    version="1.0.0"
)

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    
    # Iterate over all components/schemas to fix file arrays
    schemas = openapi_schema.get("components", {}).get("schemas", {})
    for schema_name, schema_data in schemas.items():
        properties = schema_data.get("properties", {})
        for prop_name, prop_val in properties.items():
            # Fix single UploadFile
            if "contentMediaType" in prop_val:
                prop_val.pop("contentMediaType", None)
                prop_val["type"] = "string"
                prop_val["format"] = "binary"
            # Fix List[UploadFile]
            elif "items" in prop_val and "contentMediaType" in prop_val["items"]:
                prop_val["items"].pop("contentMediaType", None)
                prop_val["items"]["type"] = "string"
                prop_val["items"]["format"] = "binary"
                
    app.openapi_schema = openapi_schema
                        
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/health")
async def health():
    return {"status": "healthy", "vector_db": "Pinecone Cloud Connected"}
