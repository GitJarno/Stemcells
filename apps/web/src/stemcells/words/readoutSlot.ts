/**
 * Where the readout stands: in the controls row, in the model picker's
 * place (`upstream/substitutes/ProviderModelPicker.tsx`), so upstream's
 * fitting measures it as it measures the picker (decision 18). The
 * composer's words hand it over through the composer
 * (`upstream/substitutes/ChatComposer.tsx`).
 */
import { createContext } from "react";

import type { Readout } from "./cells";
import type { Span } from "./text";

/** The readout the words show, and what a token's click opens. */
export interface ShownReadout {
  readonly readout: Readout;
  /** The providers the Cells start on, as drivers. */
  readonly drivers: readonly string[];
  /** A token was clicked: the word it reads back, and where it is on screen. */
  readonly onWord: (mark: Span, at: DOMRect) => void;
}

/** How the composer's words show their readout (null to take it back). */
export const WordsReadoutSlot = createContext<((shown: ShownReadout | null) => void) | null>(null);

/** The readout to stand in the model picker's place, in this composer. */
export const WordsReadoutShown = createContext<ShownReadout | null>(null);
