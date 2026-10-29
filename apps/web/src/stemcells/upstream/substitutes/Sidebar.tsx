// Replaces `components/Sidebar.tsx` (`plugin.ts`): upstream's sidebar slot holds the left
// column, which shows upstream's thread list when the person chose it (`rail/LeftColumn.tsx`).
import type { ComponentProps } from "react";

import UpstreamSidebar from "../../../components/Sidebar";
import { LeftColumn } from "../../rail/LeftColumn";

export * from "../../../components/Sidebar";

export default function Sidebar(props: ComponentProps<typeof UpstreamSidebar>) {
  return <LeftColumn wide={<UpstreamSidebar {...props} />} />;
}
