# Knowledge Path MVP Manual Test

## Happy Path

1. Open a topic with at least one chapter and multiple requirements.
2. Switch to `Wissenspfad` in `TopicPage`.
3. Verify the first requirement starts automatically in `intro`.
4. Verify AI messages advance through `intro`, `explain_core`, `explain_detail`.
5. Verify the first user-facing question appears only after the rail reaches `check_short`.
6. Answer the question and verify the rail moves to `reinforce`, then to `check_final`.
7. Answer the final question and verify the requirement completes, mastery increases, and the next requirement starts automatically.
8. Complete the last requirement and verify the path shows a completed state.

## Debug Checks

1. For every assistant message, compare `Current State`, `Allowed Next States`, `Suggested Next State`, and `Applied Next State`.
2. Verify `Applied Next State` is never outside `Allowed Next States`, except when it remains the same as `Current State`.
3. Verify `State Changed` is `yes` only when the applied state differs from the current state.
4. Verify the sidebar `Allowed Next States` matches the hardcoded standard rail.

## Error / Edge Checks

1. Temporarily force the Edge Function to return an invalid `suggested_next_state` and verify the UI stays in the current state.
2. Force a failed Edge Function request and verify the error is shown without losing the existing transcript.
3. Restart the path with `Neu starten` and verify it returns to chapter 1 / requirement 1 / `intro`.
