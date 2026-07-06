const dirtySources = new Set<string>();

export function setUnsavedChanges(source: string, hasChanges: boolean) {
  if (hasChanges) dirtySources.add(source);
  else dirtySources.delete(source);
}

export function clearUnsavedChanges(source: string) {
  dirtySources.delete(source);
}

export function hasUnsavedChanges() {
  return dirtySources.size > 0;
}
