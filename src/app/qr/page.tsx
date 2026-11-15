import type { Metadata } from "next";
import ShopStandee from "@frontend/ShopStandee";

export const metadata: Metadata = { title: "Kavach · Shop QR" };

export default function Page() {
  return <ShopStandee />;
}
