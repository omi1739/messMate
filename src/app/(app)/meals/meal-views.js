"use client";

import { Grid3x3, Zap } from "lucide-react";
import { TabsGroup } from "@/components/ui/tabs";

/**
 * Switches between the two ways of logging meals.
 *
 * This exists as its own client component because the render prop has to be
 * created on the client. A server component cannot pass a function down to a
 * client component, but it can pass already-rendered children, so the two
 * panels arrive as props and the choice happens here.
 */
export function MealViews({ quick, month }) {
  return (
    <TabsGroup
      defaultValue="quick"
      tabs={[
        { value: "quick", label: "Quick log", icon: Zap },
        { value: "month", label: "Whole month", icon: Grid3x3 },
      ]}
    >
      {(view) => (view === "quick" ? quick : month)}
    </TabsGroup>
  );
}
