export interface PlanEntitlementsEditorState {
  readonly desktop: boolean;
  readonly advanced: Record<string, unknown>;
}

export function splitPlanEntitlements(
  entitlements: Record<string, unknown> | undefined,
): PlanEntitlementsEditorState {
  const values = entitlements ?? {};
  const desktop = values.desktop === true;
  const advanced = Object.fromEntries(
    Object.entries(values).filter(([key]) => key !== 'desktop'),
  );
  return { desktop, advanced };
}

export function mergePlanEntitlements(
  desktop: boolean,
  advancedText: string,
  untouchedDesktop?: unknown,
): Record<string, unknown> {
  let advanced: unknown = {};
  if (advancedText.trim()) advanced = JSON.parse(advancedText);
  if (!advanced || typeof advanced !== 'object' || Array.isArray(advanced)) {
    throw new Error('Entitlements must be a JSON object.');
  }
  const entries = Object.entries(advanced as Record<string, unknown>);
  if (entries.some(([key]) => !/^[a-z][a-z0-9_]*$/.test(key) || key === 'desktop')) {
    throw new Error('Entitlements must contain canonical keys; desktop is controlled separately.');
  }
  const values: unknown[] = entries.map(([, value]) => value);
  while (values.length) {
    const value = values.pop();
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Entitlements require finite numbers.');
    if (value !== null && typeof value === 'object') values.push(...Object.values(value as Record<string, unknown>));
  }
  const desktopValue = untouchedDesktop !== undefined ? untouchedDesktop : desktop ? true : undefined;
  return { ...(desktopValue === undefined ? {} : { desktop: desktopValue }), ...Object.fromEntries(entries) };
}
