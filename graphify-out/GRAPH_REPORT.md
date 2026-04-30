# Graph Report - speechy  (2026-05-01)

## Corpus Check
- 65 files · ~22,670 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 309 nodes · 410 edges · 16 communities detected
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.65)
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
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 23|Community 23]]

## God Nodes (most connected - your core abstractions)
1. `JobService` - 41 edges
2. `ProjectStore` - 27 edges
3. `XttsRuntime` - 19 edges
4. `JobServiceTests` - 15 edges
5. `HttpAppTests` - 12 edges
6. `VoiceStore` - 11 edges
7. `FakeJobs` - 11 edges
8. `FakeRuntime` - 11 edges
9. `FakeAudio` - 9 edges
10. `split_text_into_chunks()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `_default_jobs()` --calls--> `JobService`  [INFERRED]
  tts-server\presentation\http.py → tts-server\application\job_service.py
- `useLongFormPlaybackSession()` --calls--> `createAudioPlayer()`  [INFERRED]
  src\features\reader\application\useLongFormPlaybackSession.ts → src\features\reader\infrastructure\audioPlayer.ts
- `useLongFormPlaybackSession()` --calls--> `getProjectDownloadUrl()`  [INFERRED]
  src\features\reader\application\useLongFormPlaybackSession.ts → src\features\reader\infrastructure\ttsApi.ts
- `JobService` --uses--> `Job`  [INFERRED]
  tts-server\application\job_service.py → tts-server\domain\types.py
- `JobService` --uses--> `ProjectStore`  [INFERRED]
  tts-server\application\job_service.py → tts-server\infrastructure\project_store.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (6): create_app(), FakeJobs, FakeRuntime, FakeVoicePath, FakeVoiceStore, HttpAppTests

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (4): _derive_title(), _normalize_text(), ProjectStore, _slugify()

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (1): JobService

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (3): FakeRuntime, JobServiceTests, PromptFailureRuntime

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (10): BaseModel, InferenceOptions, sample_rate(), XttsRuntime, _default_jobs(), _default_runtime(), ProjectCreateRequest, ProjectSyncRequest (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.15
Nodes (8): createProject(), deleteProject(), fetchHealth(), fetchProject(), fetchProjects(), fetchVoices(), toApiError(), updateProject()

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (9): useLongFormPlaybackSession(), useReaderController(), useReaderHealthAndVoices(), useReaderSettings(), blockPosition(), getReaderPlaybackStatus(), progressPosition(), createAudioPlayer() (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.26
Nodes (5): _normalize_text(), Helpers for splitting long Czech text into stable render blocks., _split_oversized_sentence(), split_text_into_chunks(), SplitTextIntoChunksTests

### Community 8 - "Community 8"
Cohesion: 0.21
Nodes (2): ensure_gpu_ready(), VoiceStore

### Community 9 - "Community 9"
Cohesion: 0.2
Nodes (1): FakeAudio

### Community 10 - "Community 10"
Cohesion: 0.36
Nodes (5): checkPortAvailable(), checkPortOnHost(), findFreePort(), pipeOutput(), startProcess()

### Community 12 - "Community 12"
Cohesion: 0.48
Nodes (5): addToRemoveQueue(), dispatch(), genId(), reducer(), toast()

### Community 13 - "Community 13"
Cohesion: 0.4
Nodes (2): getStageAfterPlaybackStops(), getWorkflowStageForPlaybackState()

### Community 14 - "Community 14"
Cohesion: 0.5
Nodes (2): normalizeWhitespace(), splitOversizedSentence()

### Community 15 - "Community 15"
Cohesion: 0.6
Nodes (4): Job, RenderBlock, TimelineBlock, TypedDict

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (1): GovernanceGuardTests

## Knowledge Gaps
- **1 isolated node(s):** `Helpers for splitting long Czech text into stable render blocks.`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 2`** (27 nodes): `JobService`, `._active_job_count()`, `._assemble_project_audio()`, `._build_inference_options()`, `.cleanup_expired_jobs()`, `.create_job()`, `.create_project()`, `._delete_job_files()`, `.delete_project()`, `.get_block_audio()`, `.get_final_audio()`, `.get_job()`, `.get_project()`, `.__init__()`, `.list_projects()`, `._log_project_render_error()`, `._render_block()`, `.render_project()`, `._run_job()`, `._run_project()`, `.shutdown()`, `.update_project_metadata()`, `.wait_for_job()`, `.wait_for_project()`, `._write_block_audio()`, `._write_final_audio()`, `job_service.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (12 nodes): `ensure_gpu_ready()`, `VoiceStore`, `.__init__()`, `.list_voice_paths()`, `.load_transcript()`, `.resolve()`, `.save_upload()`, `.serialize()`, `.transcript_path_for_voice()`, `.__init__()`, `gpu.py`, `voice_store.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (10 nodes): `FakeAudio`, `.addEventListener()`, `.constructor()`, `.emitEnded()`, `.load()`, `.pause()`, `.play()`, `.removeAttribute()`, `.removeEventListener()`, `audioPlayer.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (6 nodes): `canStartPlayback()`, `getStageAfterPlaybackStops()`, `getWorkflowStageForBlocks()`, `getWorkflowStageForPlaybackState()`, `shouldAutoPlayChunkOnClick()`, `workflow.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (5 nodes): `normalizeWhitespace()`, `splitOversizedSentence()`, `splitTextIntoParagraphChunks()`, `splitTextIntoPlaybackChunks()`, `chunking.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (3 nodes): `GovernanceGuardTests`, `.test_checker_fails_closed_when_git_diff_is_unavailable()`, `test_governance_guard.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `JobService` connect `Community 2` to `Community 1`, `Community 3`, `Community 4`, `Community 7`, `Community 15`?**
  _High betweenness centrality (0.211) - this node is a cross-community bridge._
- **Why does `ProjectStore` connect `Community 1` to `Community 2`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `create_app()` connect `Community 0` to `Community 4`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `JobService` (e.g. with `Job` and `ProjectStore`) actually correct?**
  _`JobService` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `ProjectStore` (e.g. with `JobService` and `.__init__()`) actually correct?**
  _`ProjectStore` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `XttsRuntime` (e.g. with `JobService` and `VoiceStore`) actually correct?**
  _`XttsRuntime` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Helpers for splitting long Czech text into stable render blocks.` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._