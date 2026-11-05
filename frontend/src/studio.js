export const activeStatuses = ["queued", "running", "exporting"];
export const read = (key, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v != null &&
      typeof v === typeof fallback &&
      Array.isArray(v) === Array.isArray(fallback)
      ? v
      : fallback;
  } catch {
    return fallback;
  }
};
export const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
export const savedApi = () => {
  try {
    return (
      localStorage.getItem("resona.api") ?? import.meta.env.VITE_API_URL ?? ""
    );
  } catch {
    return import.meta.env.VITE_API_URL || "";
  }
};
export const saveApi = (value) => {
  try {
    localStorage.setItem("resona.api", value);
  } catch {}
};
export function downloadRecipe(
  settings,
  name = "Resona recipe",
  output = null,
) {
  const data = {
    app: "Resona",
    version: 1,
    name,
    settings: { ...settings, rights_confirmed: false },
    output,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "resona-recipe.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function parseRecipe(text, defaults) {
  const data = JSON.parse(text);
  if (
    data.app !== "Resona" ||
    data.version !== 1 ||
    !data.settings ||
    typeof data.settings !== "object"
  )
    throw Error("Choose a Resona recipe JSON file.");
  const settings = { ...defaults };
  const ranges = {
    duration: [10, 600],
    variations: [1, 4],
    tempo: [30, 300],
    gain_db: [-12, 6],
    seed: [0, 2147483647],
  };
  for (const [key, value] of Object.entries(data.settings)) {
    if (!Object.hasOwn(defaults, key) || key === "rights_confirmed") continue;
    if (key === "seed" && value === null) {
      settings.seed = null;
      continue;
    }
    if (typeof defaults[key] === "number" || key === "seed") {
      const [min, max] = ranges[key] || [0, 100];
      if (!Number.isInteger(value) || value < min || value > max)
        throw Error(`Invalid ${key} in recipe.`);
    } else if (typeof value !== typeof defaults[key])
      throw Error(`Invalid ${key} in recipe.`);
    if (
      typeof value === "string" &&
      value.length >
        ({ instructions: 2000, instruments: 300, genre: 100 }[key] || 80)
    )
      throw Error(`Recipe ${key} is too long.`);
    settings[key] = value;
  }
  if (
    !["beat", "vibe"].includes(settings.mode) ||
    !["", "2", "3", "4", "6"].includes(settings.time_signature) ||
    !/^$|^[A-G](?:#|b)? (?:major|minor)$/.test(settings.key_scale)
  )
    throw Error("Recipe contains unsupported musical controls.");
  return {
    name: String(data.name || "Imported recipe").slice(0, 80),
    settings: { ...settings, rights_confirmed: false },
  };
}
