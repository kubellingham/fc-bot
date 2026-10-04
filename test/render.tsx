import { render } from "@testing-library/react";
import { FormatProvider } from "@/components/format-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export const NOW = Date.parse("2026-10-04T12:00:00Z");

export function renderWithProviders(ui: React.ReactElement) {
  return render(
    <FormatProvider prefs={{ locale: "en-US", compact: false, timeZone: "UTC" }} now={NOW}>
      <TooltipProvider>{ui}</TooltipProvider>
    </FormatProvider>,
  );
}
