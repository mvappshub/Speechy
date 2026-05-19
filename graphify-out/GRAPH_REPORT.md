# Graph Report - speechy  (2026-05-19)

## Corpus Check
- 98 files · ~30,972 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 459 nodes · 606 edges · 17 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 118 edges (avg confidence: 0.72)
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
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 26|Community 26]]

## God Nodes (most connected - your core abstractions)
1. `JobService` - 45 edges
2. `HttpAppTests` - 25 edges
3. `ProjectStore` - 24 edges
4. `LegacyRenderService` - 21 edges
5. `XttsRuntime` - 20 edges
6. `FakeJobs` - 16 edges
7. `JobServiceTests` - 16 edges
8. `requestJson()` - 15 edges
9. `TaskRegistry` - 15 edges
10. `InferenceOptions` - 14 edges

## Surprising Connections (you probably didn't know these)
- `create_jobs()` --calls--> `JobService`  [INFERRED]
  tts-server\presentation\dependencies.py → tts-server\application\job_service.py
- `startPlaybackForPreparedProject()` --calls--> `startProjectRender()`  [INFERRED]
  src\features\reader\application\playbackSessionCommands.ts → src\features\reader\infrastructure\ttsApi.ts
- `applyOpenedProjectPlaybackState()` --calls--> `dispatch()`  [INFERRED]
  src\features\reader\application\playbackSessionCommands.ts → src\hooks\use-toast.ts
- `resolvePreparedProjectDownloadUrl()` --calls--> `resolveProjectDownloadUrl()`  [INFERRED]
  src\features\reader\application\playbackSessionCommands.ts → src\features\reader\application\projectPlaybackView.ts
- `applyPlaybackLoadingState()` --calls--> `dispatch()`  [INFERRED]
  src\features\reader\application\playbackTransitions.ts → src\hooks\use-toast.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (6): create_app(), FakeJobs, FakeRuntime, FakeVoicePath, FakeVoiceStore, HttpAppTests

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (3): ProjectAudioAssembler, JobService, TaskRegistry

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (10): build_project_block_filename(), build_project_cache_key(), build_synced_project_blocks(), derive_project_title(), normalize_project_text(), slugify_project_value(), hydrate_loaded_project(), recompute_project_timeline() (+2 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (19): attemptDesiredPlaybackOrStartPolling(), shouldStartProjectRender(), applyOpenedProjectPlaybackState(), resolvePreparedProjectDownloadUrl(), startPlaybackForPreparedProject(), buildPlaybackChunksFromProject(), getProjectPlaybackError(), useReaderControllerHandlers() (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (12): ProjectRenderService, BaseModel, InferenceOptions, sample_rate(), XttsRuntime, create_jobs(), create_runtime(), parse_inference_options() (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (29): resolveProjectDownloadUrl(), clearProjectBlockAudioCache(), ensureActiveProjectAudioCache(), fetchProjectBlockAudioBlob(), preloadProjectBlockAudio(), createProject(), deleteProject(), fetchHealth() (+21 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (21): applyPlaybackIdleState(), applyPlaybackLoadingState(), applySplitBlocksState(), buildResolvedBlockVoices(), buildUpdatedBlockVoices(), clearReaderProjectState(), prepareReaderProject(), applyOpenedProjectState() (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (3): FakeRuntime, JobServiceTests, PromptFailureRuntime

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (5): LegacyRenderService, Job, RenderBlock, TimelineBlock, TypedDict

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

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (2): deriveAppliedProjectRuntime(), getProjectAudioCacheSignature()

### Community 26 - "Community 26"
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
- **Thin community `Community 19`** (3 nodes): `deriveAppliedProjectRuntime()`, `getProjectAudioCacheSignature()`, `projectPlaybackState.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (3 nodes): `GovernanceGuardTests`, `.test_checker_fails_closed_when_git_diff_is_unavailable()`, `test_governance_guard.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `JobService` connect `Community 1` to `Community 2`, `Community 4`, `Community 7`, `Community 8`, `Community 9`?**
  _High betweenness centrality (0.182) - this node is a cross-community bridge._
- **Why does `create_app()` connect `Community 0` to `Community 4`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `ProjectStore` connect `Community 2` to `Community 1`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 18 inferred relationships involving `JobService` (e.g. with `LegacyRenderService` and `ProjectAudioAssembler`) actually correct?**
  _`JobService` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `ProjectStore` (e.g. with `JobService` and `.__init__()`) actually correct?**
  _`ProjectStore` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `LegacyRenderService` (e.g. with `JobService` and `Job`) actually correct?**
  _`LegacyRenderService` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `XttsRuntime` (e.g. with `JobService` and `LegacyRenderService`) actually correct?**
  _`XttsRuntime` has 8 INFERRED edges - model-reasoned connections that need verification._