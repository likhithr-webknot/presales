-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to KnowledgeBaseEntry after Prisma creates the table
-- Run this after `prisma migrate dev` creates the base tables
ALTER TABLE "KnowledgeBaseEntry" ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create IVFFlat index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx
  ON "KnowledgeBaseEntry"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
