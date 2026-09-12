"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ShowArchivedToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggle() {
    const next = new URLSearchParams(searchParams.toString());
    if (active) {
      next.delete("archived");
    } else {
      next.set("archived", "1");
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Button variant="outline" className="border-ivory/20 text-ivory" onClick={toggle}>
      {active ? "Hide archived" : "Show archived"}
    </Button>
  );
}
