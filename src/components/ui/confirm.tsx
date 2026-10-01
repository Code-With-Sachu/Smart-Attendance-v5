"use client";
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "./dialog";
import { Button } from "./button";

type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

const Ctx = React.createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

/** `const confirm = useConfirm(); if (await confirm({...})) …` */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = React.useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })),
    [],
  );
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Dialog open={!!state} onOpenChange={(o) => !o && close(false)}>
        {state && (
          <DialogContent title={state.title} size="sm" hideClose>
            <DialogBody className="flex gap-3">
              {state.tone === "danger" && (
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
                  <AlertTriangle className="size-4" aria-hidden />
                </div>
              )}
              <div className="text-sm text-fg-muted">{state.description}</div>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => close(false)}>
                {state.cancelLabel ?? "Cancel"}
              </Button>
              <Button variant={state.tone === "danger" ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
                {state.confirmLabel ?? "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  return React.useContext(Ctx);
}
