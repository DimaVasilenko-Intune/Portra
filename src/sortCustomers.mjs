// Customer list ordering. Requested in issue #1.
//
// Sorting is a view concern: it never rewrites the stored order, so switching to A–Z and back
// leaves the user's own arrangement intact. 'custom' *is* the stored array order — which is what
// the list has always shown (insertion order) and what dragging rearranges.

export const SORT_MODES = [
  { id: 'custom', label: 'Custom order' },
  { id: 'az', label: 'Name A–Z' },
  { id: 'za', label: 'Name Z–A' },
  { id: 'most-used', label: 'Most used' }
];

const isMode = (mode) => SORT_MODES.some((m) => m.id === mode);

export function sortCustomers(customers, mode) {
  const list = Array.isArray(customers) ? [...customers] : [];
  if (!isMode(mode) || mode === 'custom') return list;

  // System locale, so Scandinavian users get æ/ø/å where they expect them. Numeric collation so
  // "Customer 2" precedes "Customer 10" instead of sorting as text.
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const byName = (a, b) => collator.compare(a?.name || '', b?.name || '');

  if (mode === 'az') return list.sort(byName);
  if (mode === 'za') return list.sort((a, b) => byName(b, a));

  // Most used first. Ties break on most recently opened, then name, so the result is stable
  // rather than dependent on where a customer happened to sit in the array.
  return list.sort(
    (a, b) =>
      (b?.openCount || 0) - (a?.openCount || 0) ||
      (b?.lastOpenedAt || 0) - (a?.lastOpenedAt || 0) ||
      byName(a, b)
  );
}

// Moving a customer has to act on the stored array, not the sorted view, so the caller passes the
// ids either side of the drop. Returns a new array; the original is untouched.
export function moveCustomer(customers, draggedId, targetId) {
  const list = Array.isArray(customers) ? [...customers] : [];
  if (draggedId === targetId) return list;

  const from = list.findIndex((c) => c.id === draggedId);
  const to = list.findIndex((c) => c.id === targetId);
  if (from === -1 || to === -1) return list;

  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  return list;
}
