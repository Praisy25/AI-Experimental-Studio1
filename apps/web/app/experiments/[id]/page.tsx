
import { Suspense } from "react";
import ExperimentDetailsClient from "./ExperimentDetailsClient";

export default function ExperimentDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0b0d12] p-8 text-slate-100">
          Loading experiment...
        </main>
      }
    >
      <ExperimentDetailsClient />
    </Suspense>
  );
}
