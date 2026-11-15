import type { Metadata } from "next";
import BankConsole from "@frontend/BankConsole";

export const metadata: Metadata = { title: "Kavach · Bank" };

export default function Page() {
  return <BankConsole />;
}
