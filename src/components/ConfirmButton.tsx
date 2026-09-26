"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Botón submit que pide confirmación antes de enviar el formulario. */
export default function ConfirmButton({
  message, className = "btn-danger", children, name, value,
}: {
  message: string;
  className?: string;
  children: ReactNode;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
