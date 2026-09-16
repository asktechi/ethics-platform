"use client";

import Link from "next/link";

export const CLASS_ARCHIVED_TOAST = "Class archived. Restore it from /classes/archived.";

export function ClassArchivedToast() {
  return (
    <p
      role="status"
      data-archive-toast="true"
      className="mt-4 border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold"
    >
      Class archived. Restore it from{" "}
      <Link href="/classes/archived" className="underline underline-offset-2 hover:text-ivory">
        /classes/archived
      </Link>
      .
    </p>
  );
}
