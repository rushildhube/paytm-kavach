import type { Metadata } from "next";
import CustomerApp from "@frontend/CustomerApp";

export const metadata: Metadata = { title: "Kavach · Customer" };

export default function Page() {
  return <CustomerApp />;
}
