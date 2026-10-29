import { birth } from "./act-birth.ts";
import { calls } from "./act-calls.ts";
import { grow } from "./act-grow.ts";
import { home } from "./act-home.ts";

export function acts(): void {
  birth(document.querySelector<HTMLElement>("#birth")!);
  grow(document.querySelector<HTMLElement>("#grow")!);
  calls(document.querySelector<HTMLElement>("#calls")!);
  home(document.querySelector<HTMLElement>("#home")!);
}
