import { ConflictBanner } from "./ConflictBanner";
import { DeployDialog } from "./DeployDialog";
import { DocumentEditModal } from "./DocumentEditModal";
import { ResultsPane } from "./ResultsPane";

export function PreviewPanel() {
  return (
    <div data-testid="preview-panel" className="flex flex-col overflow-auto">
      <ConflictBanner />
      <DeployDialog />
      <ResultsPane />
      <DocumentEditModal />
    </div>
  );
}
