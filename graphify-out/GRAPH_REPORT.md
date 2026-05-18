# Graph Report - speechy  (2026-05-18)

## Corpus Check
- 73 files · ~27,775 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 363 nodes · 486 edges · 17 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 55 edges (avg confidence: 0.66)
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
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 24|Community 24]]

## God Nodes (most connected - your core abstractions)
1. `JobService` - 44 edges
2. `ProjectStore` - 27 edges
3. `XttsRuntime` - 19 edges
4. `JobServiceTests` - 16 edges
5. `HttpAppTests` - 15 edges
6. `requestJson()` - 14 edges
7. `TaskRegistry` - 14 edges
8. `FakeJobs` - 13 edges
9. `ProjectRenderService` - 11 edges
10. `VoiceStore` - 11 edges

## Surprising Connections (you probably didn't know these)
- `useLongFormPlaybackSession()` --calls--> `useProjectPreparation()`  [INFERRED]
  src\features\reader\application\useLongFormPlaybackSession.ts → src\features\reader\application\useProjectPreparation.ts
- `JobService` --calls--> `_default_jobs()`  [INFERRED]
  tts-server\application\job_service.py → tts-server\presentation\http.py
- `useLongFormPlaybackSession()` --calls--> `useProjectPolling()`  [INFERRED]
  src\features\reader\application\useLongFormPlaybackSession.ts → src\features\reader\application\useProjectPolling.ts
- `useLongFormPlaybackSession()` --calls--> `getProjectDownloadUrl()`  [INFERRED]
  src\features\reader\application\useLongFormPlaybackSession.ts → src\features\reader\infrastructure\ttsApi.ts
- `ProjectAudioAssembler` --uses--> `JobService`  [INFERRED]
  tts-server\application\audio_assembly.py → tts-server\application\job_service.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (6): create_app(), FakeJobs, FakeRuntime, FakeVoicePath, FakeVoiceStore, HttpAppTests

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (5): JobService, Job, RenderBlock, TimelineBlock, TypedDict

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (4): _derive_title(), _normalize_text(), ProjectStore, _slugify()

### Community 3 - "Community 3"
Cohesion: 0.15
Nodes (23): clearProjectBlockAudioCache(), createProject(), deleteProject(), ensureActiveProjectAudioCache(), fetchHealth(), fetchProject(), fetchProjectBlockAudioBlob(), fetchProjects() (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (3): FakeRuntime, JobServiceTests, PromptFailureRuntime

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (11): useAudioPlaybackSession(), useLongFormPlaybackSession(), useProjectPolling(), useReaderController(), useReaderHealthAndVoices(), useReaderSettings(), blockPosition(), getReaderPlaybackStatus() (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (10): BaseModel, InferenceOptions, sample_rate(), XttsRuntime, _default_jobs(), _default_runtime(), ProjectCreateRequest, ProjectSyncRequest (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (2): ProjectAudioAssembler, ProjectRenderService

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (1): TaskRegistry

### Community 9 - "Community 9"
Cohesion: 0.21
Nodes (2): ensure_gpu_ready(), VoiceStore

### Community 10 - "Community 10"
Cohesion: 0.26
Nodes (5): _normalize_text(), Helpers for splitting long Czech text into stable render blocks., _split_oversized_sentence(), split_text_into_chunks(), SplitTextIntoChunksTests

### Community 11 - "Community 11"
Cohesion: 0.25
Nodes (7): applyProjectToReaderState(), useProjectPreparation(), addToRemoveQueue(), dispatch(), genId(), reducer(), toast()

### Community 12 - "Community 12"
Cohesion: 0.2
Nodes (1): FakeAudio

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (6): canBindPortOnHost(), checkPortAvailable(), findFreePort(), hasLocalListener(), pipeOutput(), startProcess()

### Community 15 - "Community 15"
Cohesion: 0.4
Nodes (2): getStageAfterPlaybackStops(), getWorkflowStageForPlaybackState()

### Community 16 - "Community 16"
Cohesion: 0.5
Nodes (2): normalizeWhitespace(), splitOversizedSentence()

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (1): GovernanceGuardTests

## Knowledge Gaps
- **1 isolated node(s):** `Helpers for splitting long Czech text into stable render blocks.`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 7`** (14 nodes): `ProjectAudioAssembler`, `.assemble_project_audio()`, `.__init__()`, `.__init__()`, `ProjectRenderService`, `._build_inference_options()`, `.__init__()`, `._log_project_render_error()`, `._render_block()`, `.render_project()`, `._run_project()`, `.wait_for_project()`, `audio_assembly.py`, `project_render_service.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (13 nodes): `TaskRegistry`, `.active_job_count()`, `.cancel_project()`, `.__init__()`, `.project_job_id()`, `.project_task()`, `.remove_legacy_job()`, `.shutdown()`, `.start_legacy_job()`, `.start_project_job()`, `.wait_for_legacy_job()`, `.wait_for_project()`, `task_registry.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (12 nodes): `ensure_gpu_ready()`, `VoiceStore`, `.__init__()`, `.list_voice_paths()`, `.load_transcript()`, `.resolve()`, `.save_upload()`, `.serialize()`, `.transcript_path_for_voice()`, `.__init__()`, `gpu.py`, `voice_store.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (10 nodes): `FakeAudio`, `.addEventListener()`, `.constructor()`, `.emitEnded()`, `.load()`, `.pause()`, `.play()`, `.removeAttribute()`, `.removeEventListener()`, `audioPlayer.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (6 nodes): `canStartPlayback()`, `getStageAfterPlaybackStops()`, `getWorkflowStageForBlocks()`, `getWorkflowStageForPlaybackState()`, `shouldAutoPlayChunkOnClick()`, `workflow.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (5 nodes): `normalizeWhitespace()`, `splitOversizedSentence()`, `splitTextIntoParagraphChunks()`, `splitTextIntoPlaybackChunks()`, `chunking.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (3 nodes): `GovernanceGuardTests`, `.test_checker_fails_closed_when_git_diff_is_unavailable()`, `test_governance_guard.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `JobService` connect `Community 1` to `Community 2`, `Community 4`, `Community 6`, `Community 7`, `Community 8`, `Community 10`?**
  _High betweenness centrality (0.219) - this node is a cross-community bridge._
- **Why does `create_app()` connect `Community 0` to `Community 6`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `ProjectStore` connect `Community 2` to `Community 1`, `Community 7`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `JobService` (e.g. with `ProjectAudioAssembler` and `ProjectRenderService`) actually correct?**
  _`JobService` has 17 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `ProjectStore` (e.g. with `JobService` and `.__init__()`) actually correct?**
  _`ProjectStore` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `XttsRuntime` (e.g. with `JobService` and `VoiceStore`) actually correct?**
  _`XttsRuntime` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Helpers for splitting long Czech text into stable render blocks.` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._