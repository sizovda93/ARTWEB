import { Suspense } from "react";
import { RefreshHandler } from "./refresh-handler";

export default function RefreshSessionPage() {
  return (
    <Suspense>
      <RefreshHandler />
    </Suspense>
  );
}
