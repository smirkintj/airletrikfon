import { NextResponse } from "next/server";
import { auth, authEnabled } from "@/lib/auth";

// Proxies the browser's auth requests to Neon Auth.
const handlers = () => auth().handler();
const off = () => NextResponse.json({ error: "Auth isn't configured" }, { status: 404 });

type Handler = (req: Request, ctx: { params: Promise<{ path: string[] }> }) => Promise<Response>;
const route = (method: "GET" | "POST"): Handler => (req, ctx) => (authEnabled() ? (handlers()[method] as Handler)(req, ctx) : Promise.resolve(off()));

export const GET = route("GET");
export const POST = route("POST");
