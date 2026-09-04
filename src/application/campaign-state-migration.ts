export const migrateCampaignState = (value: unknown): unknown => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Reflect.get(value, "id") !== "cmp_local"
  ) {
    return value;
  }
  const schemaVersion = Reflect.get(value, "schemaVersion");
  if (schemaVersion !== undefined && schemaVersion !== 1 && schemaVersion !== 2) {
    return value;
  }
  const wars = Reflect.get(value, "wars");
  return {
    ...value,
    schemaVersion: 2,
    ...(Array.isArray(wars)
      ? {
          wars: wars.map((war, index) =>
            typeof war === "object" && war !== null && !Array.isArray(war)
              ? {
                  ...war,
                  id:
                    Reflect.get(war, "id") ??
                    `war_${String(Reflect.get(war, "declaredTurn"))}_${index}`,
                  status: Reflect.get(war, "status") ?? "active",
                }
              : war,
          ),
        }
      : {}),
  };
};
