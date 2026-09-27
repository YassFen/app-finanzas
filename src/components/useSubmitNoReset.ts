"use client";

import { startTransition, type FormEvent } from "react";

/**
 * React 19 resetea el <form action={...}> tras cada envío, lo que desincroniza los
 * <select> controlados. Este onSubmit llama a la acción sin ese reset automático.
 * Conserva el botón que envió el formulario (ej. name="seguir").
 */
export function useSubmitNoReset(action: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => action(fd));
  };
}
