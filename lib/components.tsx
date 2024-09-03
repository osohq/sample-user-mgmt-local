"use client";

import React from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ action }: { action: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Saving..." : action}
    </button>
  );
}
