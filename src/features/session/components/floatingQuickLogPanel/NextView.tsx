import { PrimaryButton, SecondaryButton } from '../../../../components/Button';
import { PanelViewHeader, type DragGripProps } from './PanelViewHeader';
import { HighlightText, MutedText, PanelHeading } from './TextHighlight';

export function NextView(props: {
  gripProps: DragGripProps;
  onNextSubproblem: () => void;
  onNewProblem: () => void;
  onMarkProgress: () => void;
  onFinishExercise: () => void;
}) {
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
        <PrimaryButton className="w-full" onClick={props.onNextSubproblem}>
          Nächste Teilaufgabe
        </PrimaryButton>
        <PrimaryButton className="w-full" onClick={props.onNewProblem}>
          Neue Aufgabe
        </PrimaryButton>
        <SecondaryButton className="w-full" onClick={props.onMarkProgress}>
          Zwischenstand
        </SecondaryButton>
        <SecondaryButton className="w-full" onClick={props.onFinishExercise}>
          Übung beenden
        </SecondaryButton>
      </div>
    </div>
  );
}
