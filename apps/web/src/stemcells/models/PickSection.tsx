import type { ReactNode } from "react";

import { cn } from "../upstream/ui";

/**
 * One section of the pick (Model, Effort, Access): a caption over its controls on the pick's
 * grid, where agents' marks hang in a gutter and captions and tracks start past it. A body with
 * marks of its own (`gutter`) draws the gutter itself.
 */
export function PickSection(props: {
  readonly title: string;
  readonly accessory?: ReactNode;
  readonly gutter?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5 px-2.5 pt-2.5">
      <div className="flex min-h-6 items-center justify-between gap-2 ps-7">
        <h3 className="font-medium text-muted-foreground text-xs">{props.title}</h3>
        {props.accessory}
      </div>
      <div className={cn("flex flex-col gap-1.5", !props.gutter && "ps-7")}>{props.children}</div>
    </section>
  );
}
