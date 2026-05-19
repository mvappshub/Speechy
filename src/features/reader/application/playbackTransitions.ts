import type { ReaderAction } from "./readerActions";
import { readerActions } from "./readerActions";
import { getStageAfterPlaybackStops } from "../domain/workflow";

type Dispatch = (action: ReaderAction) => void;

export function applyPlaybackIdleState(dispatch: Dispatch, hasBlocks: boolean) {
  dispatch(readerActions.setPlaybackState("idle"));
  dispatch(readerActions.setWorkflowStage(getStageAfterPlaybackStops(hasBlocks)));
}

export function applyPlaybackLoadingState(dispatch: Dispatch) {
  dispatch(readerActions.setPlaybackState("loading"));
  dispatch(readerActions.setWorkflowStage("playing"));
}
