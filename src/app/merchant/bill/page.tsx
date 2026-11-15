import type { Metadata } from "next";
import BillPanel from "@frontend/BillPanel";

export const metadata: Metadata = { title: "Kavach · Bill QR" };

export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[#F5F7FA] p-4">
      <BillPanel />
    </main>
  );
}
