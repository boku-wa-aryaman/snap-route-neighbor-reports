import { lazy, Suspense, type ComponentProps } from "react";
import { ClientOnly } from "@tanstack/react-router";

const IssuesMapImpl = lazy(() => import("./IssuesMap"));
const PickerMapImpl = lazy(() => import("./IssuesMap").then((m) => ({ default: m.PickerMap })));

const Fallback = ({ className }: { className?: string }) => <div className={`animate-pulse bg-muted ${className ?? ""}`} />;

export function IssuesMap(props: ComponentProps<typeof IssuesMapImpl>) {
  return (
    <ClientOnly fallback={<Fallback className={props.className} />}>
      <Suspense fallback={<Fallback className={props.className} />}>
        <IssuesMapImpl {...props} />
      </Suspense>
    </ClientOnly>
  );
}

export function PickerMap(props: ComponentProps<typeof PickerMapImpl>) {
  return (
    <ClientOnly fallback={<Fallback className={props.className} />}>
      <Suspense fallback={<Fallback className={props.className} />}>
        <PickerMapImpl {...props} />
      </Suspense>
    </ClientOnly>
  );
}
