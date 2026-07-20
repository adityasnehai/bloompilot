"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function DiagnosisSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Scanning…" : "Run scan"}
    </Button>
  );
}
