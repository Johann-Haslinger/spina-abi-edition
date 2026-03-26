import type { Requirement } from '../../../../../domain/models';
import { formatRailStateList } from '../learnPathUtils';
import type { RailState } from '../rail/standardRequirementRail';

export function LearnPathSidebar(props: {
  currentState: RailState;
  currentAllowedNextStates: RailState[];
  currentRequirement?: Requirement;
  requirementGoal: string;
  subjectName?: string;
  topicName?: string;
  currentChapterName?: string;
  currentRequirementName?: string;
}) {
  return (
    <aside className="space-y-4">
      <div className="rounded-3xl border border-white/8 bg-slate-950/25 p-4">
        <div className="text-xs uppercase tracking-wide text-white/45">Debug</div>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-white/45">Current State</dt>
            <dd className="mt-1 text-white">{props.currentState}</dd>
          </div>
          <div>
            <dt className="text-white/45">Allowed Next States</dt>
            <dd className="mt-1 text-white">
              {formatRailStateList(props.currentAllowedNextStates)}
            </dd>
          </div>
          <div>
            <dt className="text-white/45">Requirement Goal</dt>
            <dd className="mt-1 text-white/80">
              {props.currentRequirement ? props.requirementGoal : '–'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-3xl border border-white/8 bg-slate-950/25 p-4">
        <div className="text-xs uppercase tracking-wide text-white/45">Kontext</div>
        <div className="mt-3 space-y-3 text-sm text-white/80">
          <div>
            <div className="text-white/45">Fach</div>
            <div className="mt-1">{props.subjectName ?? '–'}</div>
          </div>
          <div>
            <div className="text-white/45">Thema</div>
            <div className="mt-1">{props.topicName ?? '–'}</div>
          </div>
          <div>
            <div className="text-white/45">Kapitel</div>
            <div className="mt-1">{props.currentChapterName ?? '–'}</div>
          </div>
          <div>
            <div className="text-white/45">Requirement</div>
            <div className="mt-1">{props.currentRequirementName ?? '–'}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
