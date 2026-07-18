export interface ActionPinningFinding {
  file: string;
  line: number;
  reference: string;
}

export function collectWorkflowFiles(target: string): Promise<string[]>;
export function findUnpinnedActions(file: string, source: string): ActionPinningFinding[];
