# Graph Report - speechy  (2026-05-19)

## Corpus Check
- 80 files · ~28,414 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 399 nodes · 535 edges · 16 communities detected
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 78 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 23|Community 23]]

## God Nodes (most connected - your core abstractions)
1. `JobService` - 45 edges
2. `ProjectStore` - 27 edges
3. `LegacyRenderService` - 21 edges
4. `XttsRuntime` - 20 edges
5. `JobServiceTests` - 16 edges
6. `TaskRegistry` - 15 edges
7. `HttpAppTests` - 15 edges
8. `requestJson()` - 14 edges
9. `InferenceOptions` - 13 edges
10. `FakeJobs` - 13 edges

## Surprising Connections (you probably didn't know these)
- `useLongFormPlaybackSession()` --calls--> `useProjectPreparation()`  [INFERRED]
  src\features\reader\application\useLongFormPlaybackSession.ts → src\features\reader\application\useProjectPreparation.ts
- `useLongFormPlaybackSession()` --calls--> `useProjectPolling()`  [INFERRED]
  src\features\reader\application\useLongFormPlaybackSession.ts → src\features\reader\application\useProjectPolling.ts
- `useLongFormPlaybackSession()` --calls--> `getProjectDownloadUrl()`  [INFERRED]
  src\features\reader\application\useLongFormPlaybackSession.ts → src\features\reader\infrastructure\ttsApi.ts
- `applyProjectToReaderState()` --calls--> `dispatch()`  [INFERRED]
  src\features\reader\application\useProjectPreparation.ts → src\hooks\use-toast.ts
- `resetReaderEditingState()` --calls--> `dispatch()`  [INFERRED]
  src\features\reader\application\useProjectPreparation.ts → src\hooks\use-toast.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (11): JobService, BaseModel, InferenceOptions, sample_rate(), XttsRuntime, _default_jobs(), _default_runtime(), ProjectCreateRequest (+3 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (9): build_project_block_filename(), build_project_cache_key(), build_synced_project_blocks(), derive_project_title(), normalize_project_text(), slugify_project_value(), recompute_project_timeline(), ProjectStore (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (6): create_app(), FakeJobs, FakeRuntime, FakeVoicePath, FakeVoiceStore, HttpAppTests

### Community 3 - "Community 3"
Cohesion: 0.15
Nodes (25): clearProjectBlockAudioCache(), createProject(), deleteProject(), ensureActiveProjectAudioCache(), fetchHealth(), fetchProject(), fetchProjectBlockAudioBlob(), fetchProjects() (+17 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (3): ProjectAudioAssembler, ProjectRenderService, TaskRegistry

### Community 5 - "Community 5"
Cohesion: 0.15
Nodes (3): FakeRuntime, JobServiceTests, PromptFailureRuntime

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (11): useAudioPlaybackSession(), useLongFormPlaybackSession(), useProjectPolling(), useReaderController(), useReaderHealthAndVoices(), useReaderSettings(), blockPosition(), getReaderPlaybackStatus() (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (5): LegacyRenderService, Job, RenderBlock, TimelineBlock, TypedDict

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (12): applyOpenedProjectState(), applyProjectToReaderState(), resetReaderEditingState(), useProjectPreparation(), getStageAfterPlaybackStops(), getWorkflowStageForBlocks(), getWorkflowStageForPlaybackState(), addToRemoveQueue() (+4 more)

### Community 9 - "Community 9"
Cohesion: 0.23
Nodes (5): _normalize_text(), Helpers for splitting long Czech text into stable render blocks., _split_oversized_sentence(), split_text_into_chunks(), SplitTextIntoChunksTests

### Community 10 - "Community 10"
Cohesion: 0.21
Nodes (2): ensure_gpu_ready(), VoiceStore

### Community 11 - "Community 11"
Cohesion: 0.2
Nodes (1): FakeAudio

### Community 12 - "Community 12"
Cohesion: 0.33
Nodes (6): canBindPortOnHost(), checkPortAvailable(), findFreePort(), hasLocalListener(), pipeOutput(), startProcess()

### Community 14 - "Community 14"
Cohesion: 0.7
Nodes (4): buildPlaybackTracePayload(), emitPlaybackTrace(), getDesiredBlock(), tracePlaybackEvent()

### Community 15 - "Community 15"
Cohesion: 0.5
Nodes (2): normalizeWhitespace(), splitOversizedSentence()

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (1): GovernanceGuardTests

## Knowledge Gaps
- **1 isolated node(s):** `Helpers for splitting long Czech text into stable render blocks.`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 10`** (12 nodes): `ensure_gpu_ready()`, `VoiceStore`, `.__init__()`, `.list_voice_paths()`, `.load_transcript()`, `.resolve()`, `.save_upload()`, `.serialize()`, `.transcript_path_for_voice()`, `.__init__()`, `gpu.py`, `voice_store.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (10 nodes): `FakeAudio`, `.addEventListener()`, `.constructor()`, `.emitEnded()`, `.load()`, `.pause()`, `.play()`, `.removeAttribute()`, `.removeEventListener()`, `audioPlayer.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (5 nodes): `normalizeWhitespace()`, `splitOversizedSentence()`, `splitTextIntoParagraphChunks()`, `splitTextIntoPlaybackChunks()`, `chunking.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (3 nodes): `GovernanceGuardTests`, `.test_checker_fails_closed_when_git_diff_is_unavailable()`, `test_governance_guard.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `JobService` connect `Community 0` to `Community 1`, `Community 4`, `Community 5`, `Community 7`, `Community 9`?**
  _High betweenness centrality (0.213) - this node is a cross-community bridge._
- **Why does `ProjectStore` connect `Community 1` to `Community 0`, `Community 4`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `create_app()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Are the 18 inferred relationships involving `JobService` (e.g. with `LegacyRenderService` and `ProjectAudioAssembler`) actually correct?**
  _`JobService` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `ProjectStore` (e.g. with `JobService` and `.__init__()`) actually correct?**
  _`ProjectStore` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `LegacyRenderService` (e.g. with `JobService` and `Job`) actually correct?**
  _`LegacyRenderService` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `XttsRuntime` (e.g. with `JobService` and `LegacyRenderService`) actually correct?**
  _`XttsRuntime` has 8 INFERRED edges - model-reasoned connections that need verification._