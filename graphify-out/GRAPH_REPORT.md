# Graph Report - speechy  (2026-05-01)

## Corpus Check
- 109 files · ~58,844 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 769 nodes · 1159 edges · 24 communities detected
- Extraction: 80% EXTRACTED · 20% INFERRED · 0% AMBIGUOUS · INFERRED: 234 edges (avg confidence: 0.6)
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
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 54|Community 54]]

## God Nodes (most connected - your core abstractions)
1. `JobService` - 41 edges
2. `OmniVoice` - 34 edges
3. `RuleDurationEstimator` - 32 edges
4. `StreamLengthGroupDataset` - 30 edges
5. `WebDatasetReader` - 30 edges
6. `JsonlDatasetReader` - 29 edges
7. `ProjectStore` - 27 edges
8. `XttsRuntime` - 21 edges
9. `JobServiceTests` - 15 edges
10. `IterableDataReader` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Single-item inference CLI for OmniVoice.  Generates audio from a single text i` --uses--> `OmniVoice`  [INFERRED]
  OmniVoice\omnivoice\cli\infer.py → OmniVoice\omnivoice\models\omnivoice.py
- `Auto-detect the best available device: CUDA > MPS > CPU.` --uses--> `OmniVoice`  [INFERRED]
  OmniVoice\omnivoice\cli\infer.py → OmniVoice\omnivoice\models\omnivoice.py
- `main()` --calls--> `read_test_list()`  [INFERRED]
  OmniVoice\omnivoice\cli\infer_batch.py → OmniVoice\omnivoice\utils\data_utils.py
- `main()` --calls--> `OmniTrainer`  [INFERRED]
  OmniVoice\omnivoice\cli\train.py → OmniVoice\omnivoice\training\trainer.py
- `StreamLengthGroupDataset` --uses--> `IterableDataReader`  [INFERRED]
  OmniVoice\omnivoice\data\batching.py → OmniVoice\omnivoice\data\dataset.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (69): build_demo(), build_parser(), get_best_device(), main(), Auto-detect the best available device: CUDA > MPS > CPU., cluster_samples_by_batch_size(), cluster_samples_by_duration(), estimate_sample_total_duration() (+61 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (39): main(), PackingIterableDataset, An IterableDataset that dynamically processes samples using a processor     and, Set the epoch for shuffling., A streaming dataset that groups samples by their lengths into buckets.     Only, Set the epoch for shuffling., PackingDataCollator, IterableDataReader (+31 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (17): JobService, BaseModel, Job, RenderBlock, TimelineBlock, ensure_gpu_ready(), VoiceStore, InferenceOptions (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (37): StreamLengthGroupDataset, JsonlDatasetReader, Set the epoch for shuffling., Read raw JSONL and load audio files, matching WebDatasetReader output format., WebDatasetReader, build_parser(), CollatedBatch, CollateFunction (+29 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (43): Called periodically to log to TensorBoard/WandB and console., log_metrics(), process_one(), Computes WER and related metrics for a single hypothesis-truth pair.      Args, Log weighted WER metrics for a subset of results., clean_cjk_spaces(), get_parser(), load_omni_model() (+35 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (31): load_eval_waveform(), Load an audio file, preprocess it, and convert to a PyTorch tensor.      Args:, Saeki_2022 paper's `UTMOS strong learner` inference model     (w/o Phoneme enco, wave-to-score :: (B, T) -> (B,), UTMOS22Strong, get_device(), get_parser(), main() (+23 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (17): useLongFormPlaybackSession(), useReaderController(), useReaderHealthAndVoices(), useReaderSettings(), blockPosition(), getReaderPlaybackStatus(), progressPosition(), createAudioPlayer() (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (16): AttentiveStatsPool, Conv1dReluBn, ECAPA_TDNN_WAVLM, in_channels == out_channels == channels, Res2Conv1dReluBn, SE_Connect, SE_Res2Block, get_device() (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (6): create_app(), FakeJobs, FakeRuntime, FakeVoicePath, FakeVoiceStore, HttpAppTests

### Community 9 - "Community 9"
Cohesion: 0.17
Nodes (4): _derive_title(), _normalize_text(), ProjectStore, _slugify()

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (13): ConvFeatureExtractionModel, MultiheadAttention, pad_to_multiple(), FeatureEncoder + ContextTransformer, :: (B, T) -> (B, Feat, Frame), Tail inverse padding., Transformer Encoder Layer used in BERT/XLM style pre-trained models., Multi-headed attention. (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.1
Nodes (23): chunked_reader(), count_lines(), pack_dataset(), process_audio_item(), read_jsonl(), audiosegment_to_numpy(), cross_fade_chunks(), fade_and_pad_audio() (+15 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (13): load_checkpoint(), Saves model, tokenizer, and accelerator states (optimizer/scheduler).     Manag, Resumes training state., Handles logging to console and trackers (TensorBoard/WandB), Called every step to update the progress bar UI., save_checkpoint(), TrainLogger, OmniTrainer (+5 more)

### Community 13 - "Community 13"
Cohesion: 0.16
Nodes (3): FakeRuntime, JobServiceTests, PromptFailureRuntime

### Community 14 - "Community 14"
Cohesion: 0.26
Nodes (5): _normalize_text(), Helpers for splitting long Czech text into stable render blocks., _split_oversized_sentence(), split_text_into_chunks(), SplitTextIntoChunksTests

### Community 15 - "Community 15"
Cohesion: 0.2
Nodes (1): FakeAudio

### Community 16 - "Community 16"
Cohesion: 0.36
Nodes (5): checkPortAvailable(), checkPortOnHost(), findFreePort(), pipeOutput(), startProcess()

### Community 18 - "Community 18"
Cohesion: 0.48
Nodes (5): addToRemoveQueue(), dispatch(), genId(), reducer(), toast()

### Community 19 - "Community 19"
Cohesion: 0.4
Nodes (2): getStageAfterPlaybackStops(), getWorkflowStageForPlaybackState()

### Community 20 - "Community 20"
Cohesion: 0.4
Nodes (4): fix_random_seed(), Used in argparse.ArgumentParser.add_argument to indicate     that a type is a b, Set the same random seed for the libraries and modules.     Includes the ``rand, str2bool()

### Community 21 - "Community 21"
Cohesion: 0.5
Nodes (2): normalizeWhitespace(), splitOversizedSentence()

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (2): lang_display_name(), Return a display-friendly version of a lowercase language name.      Uses .tit

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (1): GovernanceGuardTests

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (1): Determines the weight of a single character.

## Knowledge Gaps
- **69 isolated node(s):** `Load audio from bytes data and resample to the target sample rate if needed.`, `Prepare data manifests from a json file.     A typical multilingual json file i`, `Read a manifest file containing webdataset tar paths and label jsonl paths.`, `Decode a sample from webdataset, including loading audio/tokens and fetching lab`, `Args:           tar_to_label:             A dict mapping from audio tar file t` (+64 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 15`** (10 nodes): `FakeAudio`, `.addEventListener()`, `.constructor()`, `.emitEnded()`, `.load()`, `.pause()`, `.play()`, `.removeAttribute()`, `.removeEventListener()`, `audioPlayer.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (6 nodes): `canStartPlayback()`, `getStageAfterPlaybackStops()`, `getWorkflowStageForBlocks()`, `getWorkflowStageForPlaybackState()`, `shouldAutoPlayChunkOnClick()`, `workflow.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (5 nodes): `normalizeWhitespace()`, `splitOversizedSentence()`, `splitTextIntoParagraphChunks()`, `splitTextIntoPlaybackChunks()`, `chunking.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (3 nodes): `lang_map.py`, `lang_display_name()`, `Return a display-friendly version of a lowercase language name.      Uses .tit`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (3 nodes): `GovernanceGuardTests`, `.test_checker_fails_closed_when_git_diff_is_unavailable()`, `test_governance_guard.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `Determines the weight of a single character.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `OmniVoice` connect `Community 0` to `Community 1`, `Community 2`?**
  _High betweenness centrality (0.290) - this node is a cross-community bridge._
- **Why does `read_test_list()` connect `Community 5` to `Community 0`, `Community 4`, `Community 7`?**
  _High betweenness centrality (0.231) - this node is a cross-community bridge._
- **Why does `RuleDurationEstimator` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.229) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `JobService` (e.g. with `Job` and `ProjectStore`) actually correct?**
  _`JobService` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `OmniVoice` (e.g. with `Auto-detect the best available device: CUDA > MPS > CPU.` and `Single-item inference CLI for OmniVoice.  Generates audio from a single text i`) actually correct?**
  _`OmniVoice` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 28 inferred relationships involving `RuleDurationEstimator` (e.g. with `Auto-detect the best available device: CUDA > MPS > CPU.` and `Initializer for each worker process.      Loads model (with tokenizers and dur`) actually correct?**
  _`RuleDurationEstimator` has 28 INFERRED edges - model-reasoned connections that need verification._
- **Are the 23 inferred relationships involving `StreamLengthGroupDataset` (e.g. with `IterableDataReader` and `WrappedIterableDataset`) actually correct?**
  _`StreamLengthGroupDataset` has 23 INFERRED edges - model-reasoned connections that need verification._