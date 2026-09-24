import "server-only";
import { redirect } from "next/navigation";
import { getStore, Unauthorized, type Store } from "./store";

/** The store for the current request, sending signed-out users to /login. */
export async function store(): Promise<Store> {
  try {
    return await getStore();
  } catch (e) {
    if (e instanceof Unauthorized) redirect("/login");
    throw e;
  }
}
