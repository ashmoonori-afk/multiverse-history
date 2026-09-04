export const migrateCampaignState = (value: unknown): unknown => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Reflect.get(value, "id") !== "cmp_local" ||
    "schemaVersion" in value
  ) {
    return value;
  }
  return { ...value, schemaVersion: 2 };
};
