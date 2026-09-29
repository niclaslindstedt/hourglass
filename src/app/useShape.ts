// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMediaQuery } from "@niclaslindstedt/oss-framework/hooks";

import { DESK_QUERY } from "./shape.ts";

/** The desk shell: Settings slides in beside the glass rather than over it. */
export function useDesk(): boolean {
  return useMediaQuery(DESK_QUERY);
}
