// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect } from "react";

import { useLocalStorageState } from "@niclaslindstedt/oss-framework/hooks";

import { clampRun, halt, isRunning, newRun, turn, type Run } from "./timer.ts";

// Where the sand is, kept across reloads: the run is a few numbers read
// against the wall clock (`timer.ts`), so a glass turned over and then
// closed is still running when the app is opened again, and has run out if
// it should have.

export const RUN_KEY = "hourglass:run";

export function useRun(minutes: number) {
  const [run, setRun] = useLocalStorageState<Run>(RUN_KEY, newRun(minutes), {
    parse: (raw) => clampRun(JSON.parse(raw) as unknown, minutes),
  });

  // The length in the settings is the length of the glass: a change there
  // is a new glass, standing with its sand at the bottom.
  useEffect(() => {
    if (run.minutes !== minutes) setRun(newRun(minutes));
  }, [minutes, run.minutes, setRun]);

  const turnNow = useCallback(() => {
    setRun((prev) => turn(prev, Date.now()));
  }, [setRun]);

  const finish = useCallback(() => {
    setRun((prev) =>
      isRunning(prev, Date.now()) ? prev : halt(prev, Date.now()),
    );
  }, [setRun]);

  return { run, turnNow, finish, setRun };
}
