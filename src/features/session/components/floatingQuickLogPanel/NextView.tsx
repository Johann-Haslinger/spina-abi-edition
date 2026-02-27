import { GhostButton, PrimaryButton } from '../../../../components/Button';
import { PanelViewHeader, type DragGripProps } from './PanelViewHeader';
import { HighlightText, MutedText, PanelHeading } from './TextHighlight';

export function NextView(props: {
  gripProps: DragGripProps;
  taskDepth: 1 | 2 | 3;
  onNextSubproblem: () => void;
  onNewProblem: () => void;
  onMarkProgress: () => void;
  onFinishExercise: () => void;
}) {
  const showNextSub = props.taskDepth !== 1;
  const nextSubLabel = props.taskDepth === 3 ? 'Nächste Unteraufgabe' : 'Nächste Teilaufgabe';
  return (
    <div className="space-y-3">
      <PanelViewHeader
        left={
          <PanelHeading>
            <MutedText>Wie geht es</MutedText> <br />
            <HighlightText>weiter?</HighlightText>
          </PanelHeading>
        }
      />
      <div className="space-y-3 mt-6 gap-2">
        {showNextSub ? (
          <PrimaryButton className="w-full" onClick={props.onNextSubproblem}>
            {nextSubLabel}
          </PrimaryButton>
        ) : null}
        {showNextSub ? (
          <GhostButton className="w-full" onClick={props.onNewProblem}>
            Nächste Aufgabe
          </GhostButton>
        ) : (
          <PrimaryButton className="w-full" onClick={props.onNewProblem}>
            Nächste Aufgabe
          </PrimaryButton>
        )}
        <GhostButton className="w-full" onClick={props.onMarkProgress}>
          Zwischenstand
        </GhostButton>
        <GhostButton className="w-full" onClick={props.onFinishExercise}>
          Übung beenden
        </GhostButton>
      </div>
    </div>
  );
}
