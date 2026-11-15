import type { Metadata } from "next";
import SoundboxApp from "@frontend/SoundboxApp";

export const metadata: Metadata = { title: "Kavach · Soundbox" };

export default function Page() {
  return <SoundboxApp />;
}
