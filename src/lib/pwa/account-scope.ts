/**
 * The server-confirmed identity is the only scope truth. On changes, caller
 * clears the prior account's drafts, query cache and private temporary state.
 */
export function synchronizeAccountScope(
  currentScope: string | null,
  confirmedScope: string | null,
  clearPrivateScope: (scope: string) => void
): string | null {
  if (currentScope !== null && currentScope !== confirmedScope) {
    clearPrivateScope(currentScope);
  }
  return confirmedScope;
}
