# Graphify Knowledge Graph Skill

Graphify builds a queryable knowledge graph from this codebase. Use it to understand architecture, find relationships between components, and reduce token usage when exploring the project.

## When to Use

- Exploring unfamiliar parts of the codebase
- Understanding cross-module dependencies (domain ↔ features ↔ UI)
- Finding "god nodes" — central components that many others depend on
- Tracing how data flows through the system
- Before making changes that could affect multiple layers

## Commands

### Build / Update Graph
```bash
npm run graphify:build
```
Rebuilds `graphify-out/graph.json` from current code. Run after significant changes.

### Query the Graph
```bash
npm run graphify:query -- "your question here"
```
Uses BFS traversal to find relevant subgraph — typically ~1.7k tokens vs 100k+ for full codebase.

### Watch Mode (Dev)
```bash
npm run graphify:watch
```
Rebuilds graph automatically when code changes.

### Explain a Node
```bash
npm run graphify:explain -- "ComponentName"
```
Plain-language explanation of a component and its neighbors.

### Find Path Between Nodes
```bash
npm run graphify:path -- "ComponentA" "ComponentB"
```
Shows shortest connection path through the graph.

## Workflow

1. **First time**: Run `npm run graphify:build` to create initial graph
2. **Before exploring**: Query the graph instead of reading files manually
3. **After major changes**: Rebuild graph to keep it current
4. **When confused**: Use `graphify explain` on a component name

## Output Files

- `graphify-out/graph.json` — queryable graph data
- `graphify-out/graph.html` — visual interactive graph (open in browser)
- `graphify-out/GRAPH_REPORT.md` — god nodes, surprises, suggested questions