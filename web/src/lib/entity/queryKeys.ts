/**
 * React Query keys for F1 entity registry (Supabase).
 *
 * Usage:
 *   queryKey: entityKeys.driverProfile("max-verstappen")
 *   queryClient.invalidateQueries({ queryKey: entityKeys.all })
 */

const entityRoot = ["entity"] as const;

export const entityKeys = {
  all: entityRoot,
  drivers: {
    all: [...entityRoot, "drivers"] as const,
    profile: (slugOrErgastId: string) =>
      [...entityRoot, "drivers", "profile", slugOrErgastId] as const,
  },
  constructors: {
    all: [...entityRoot, "constructors"] as const,
    profile: (slugOrErgastId: string) =>
      [...entityRoot, "constructors", "profile", slugOrErgastId] as const,
  },
};

export type EntityQueryKey =
  | ReturnType<(typeof entityKeys)["drivers"]["profile"]>
  | ReturnType<(typeof entityKeys)["constructors"]["profile"]>;
