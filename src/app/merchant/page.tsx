import type { Metadata } from "next";
import KavachApp from "@frontend/KavachApp";

export const metadata: Metadata = { title: "Kavach · Merchant" };

export default function Page() {
  return <KavachApp controls={false} />;
}
