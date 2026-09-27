import { afterEach, beforeEach, vi } from "vitest";
import { installFoundryFakes, resetFoundryFakes } from "./helpers/foundry";

installFoundryFakes();
beforeEach(() => resetFoundryFakes());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
