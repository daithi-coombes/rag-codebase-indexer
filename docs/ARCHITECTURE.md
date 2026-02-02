# Architecture

## Purpose
Pulsar IDE plugin providing AI-assisted coding with RAG context.

## Core Responsibilities
- Pulsar IDE integration
- User interaction (views, commands)
- Context management (current file, project state)
- LLM orchestration (rag-codebase-indexer)

## Architecture Decisions

### ADR-004: Left Panel Integration
**Decision**: Custom workspace item vs modal/bottom panel
**Rationale**: Persistent access, doesn't block editor

### ADR-003: Dual-Model Approach
**Decision**:
- Embedding: nomic-embed-text
- Inference: deepseek-coder:6.7b
**Rationale**: Optimize each task separately

### ADR-001: Dependency on rag-codebase-indexer
**Decision**: Use rag-codebase-indexer as library
**Rationale**: Separation of concerns, keep this as an UI
**Trade-offs**: External dependency, but gains maintainability

## Component Interaction
```
User Input (agentic-ai-view.js)
    ↓
Context Manager (context-manager.js)
    ↓
rag-codebase-indexer (Embed Query)
    ↓
Context Assembly
    ↓
rag-codebase-indexer (Search VectorDB)
    ↓
Response Display
```

## Pulsar-Specific Concerns
- Activation/deactivation lifecycle
- Serialization/deserialization
- Command registration
- Keybinding integration

## Not Responsible For
- Generic RAG logic (delegated to library)
- Embedding algorithms (delegated to library)
- Vector database (delegated to library)
