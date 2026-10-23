import { path, SIZE } from "../cell/look";
import { brandTokenOf } from "../tokens/providers";

const CELL = path("awake");

/** A provider as its bare Cell in the provider's colour; neutral for one with none. */
export function ProviderCell(props: {
  readonly driver: string | null;
  readonly className?: string;
}) {
  const token = brandTokenOf(props.driver);
  return (
    <svg
      viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
      className={props.className}
      style={{ color: token === null ? "var(--sc-dim)" : `var(${token})` }}
      fill="currentColor"
      aria-hidden
    >
      <path d={CELL} />
    </svg>
  );
}
