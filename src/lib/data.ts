import "server-only";
import { redirect } from "next/navigation";
import { getStore, NotConfigured, Unauthorized, type Store } from "./store";

/** The store for the current request. Signed-out users go to /login; a missing setup to /setup. */
export async function store(): Promise<Store> {
  try {
    return await getStore();
  } catch (e) {
    if (e instanceof Unauthorized) redirect("/login");
    if (e instanceof NotConfigured) redirect("/setup");
    throw e;
  }
}
