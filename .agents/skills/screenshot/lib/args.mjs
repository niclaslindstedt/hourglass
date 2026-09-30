// A small argument parser: `--key value`, `--key=value`, `--flag`,
// `--no-flag`, and a key given twice (or comma-separated) collects a list.
// No dependency for this; the two scripts share it.

export function parseArgs(argv, { lists = [] } = {}) {
  const out = { _: [] };
  const push = (key, value) => {
    if (lists.includes(key)) {
      const items = String(value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      out[key] = [...(out[key] ?? []), ...items];
    } else {
      out[key] = value;
    }
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      out._.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      push(body.slice(0, eq), body.slice(eq + 1));
      continue;
    }
    if (body.startsWith("no-")) {
      out[body.slice(3)] = false;
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      push(body, next);
      i++;
    } else {
      out[body] = true;
    }
  }
  return out;
}

/** `--key a,b` or the named set from a catalogue of sets. */
export function pickSet(value, sets, catalogue, what) {
  if (value === undefined || value === true) return sets.default;
  const names = Array.isArray(value) ? value : [value];
  const picked = [];
  for (const name of names) {
    if (name in catalogue) picked.push(name);
    else if (name in sets) picked.push(...sets[name]);
    else {
      throw new Error(
        `unknown ${what} "${name}" — one of ${Object.keys(catalogue).join(", ")} or a set: ${Object.keys(sets).join(", ")}`,
      );
    }
  }
  return [...new Set(picked)];
}
