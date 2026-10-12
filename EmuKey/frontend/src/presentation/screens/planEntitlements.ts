export type EntitlementScalar = boolean | number | string;

export interface PlanEntitlementsEditorState {
  readonly desktop: boolean;
  readonly advanced: Record<string, EntitlementScalar>;
}

export function splitPlanEntitlements(
  entitlements: Record<string, unknown> | undefined,
): PlanEntitlementsEditorState {
  const values = entitlements ?? {};
  const desktop = values.desktop === true;
  const advanced = Object.fromEntries(
    Object.entries(values).filter(([key]) => key !== 'desktop'),
  );
  return { desktop, advanced: advanced as Record<string, EntitlementScalar> };
}

export function mergePlanEntitlements(
  desktop: boolean,
  advancedText: string,
  untouchedDesktop?: unknown,
): Record<string, EntitlementScalar> {
  let advanced: unknown = {};
  if (advancedText.trim()) advanced = JSON.parse(advancedText);
  if (!advanced || typeof advanced !== 'object' || Array.isArray(advanced)) {
    throw new Error('Entitlements must be a JSON object.');
  }
  const entries = Object.entries(advanced as Record<string, unknown>);
  if (entries.some(([key, value]) =>
    !/^[a-z][a-z0-9_]*$/.test(key) || key === 'desktop' ||
    !['boolean', 'number', 'string'].includes(typeof value) ||
    (typeof value === 'number' && !Number.isFinite(value)))) {
    throw new Error('Entitlements must contain canonical keys and scalar values.');
  }
  const desktopValue = typeof untouchedDesktop === 'boolean' ||
    typeof untouchedDesktop === 'string' || typeof untouchedDesktop === 'number'
    ? untouchedDesktop : desktop ? true : undefined;
  return { ...(desktopValue === undefined ? {} : { desktop: desktopValue }), ...Object.fromEntries(entries) };
}
