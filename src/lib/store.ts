import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isAllowedEmail, supabaseEnabled, supabaseServer } from "./supabase";
import type { Bill, ExtractedBill } from "./types";

/**
 * Bills live in Supabase when it's configured, otherwise in `.data/` on local disk
 * (git-ignored). Local mode has no login, so it refuses to run on Vercel.
 */
export interface Store {
  list(): Promise<Bill[]>;
  get(id: string): Promise<Bill | null>;
  add(bill: ExtractedBill, extractedBy: Bill["extractedBy"], pdf: Buffer): Promise<Bill>;
  remove(id: string): Promise<void>;
}

export class Unauthorized extends Error {}

export async function getStore(): Promise<Store> {
  if (supabaseEnabled()) return supabaseStore();
  if (process.env.VERCEL) throw new Error("Supabase isn't configured. Refusing to serve bills without a login.");
  return localStore;
}

const DATA = path.join(process.cwd(), ".data");
const INDEX = path.join(DATA, "bills.json");

async function readAll(): Promise<Bill[]> {
  try {
    return JSON.parse(await readFile(INDEX, "utf8"));
  } catch {
    return [];
  }
}

const localStore: Store = {
  list: readAll,
  async get(id) {
    return (await readAll()).find((b) => b.id === id) ?? null;
  },
  async add(extracted, extractedBy, pdf) {
    const id = randomUUID();
    await mkdir(path.join(DATA, "pdfs"), { recursive: true });
    const pdfPath = path.join("pdfs", `${id}.pdf`);
    await writeFile(path.join(DATA, pdfPath), pdf);
    const bill: Bill = { ...extracted, id, extractedBy, pdfPath, createdAt: new Date().toISOString() };
    await writeFile(INDEX, JSON.stringify([...(await readAll()), bill], null, 2));
    return bill;
  },
  async remove(id) {
    const all = await readAll();
    const bill = all.find((b) => b.id === id);
    if (bill?.pdfPath) await rm(path.join(DATA, bill.pdfPath), { force: true });
    await writeFile(INDEX, JSON.stringify(all.filter((b) => b.id !== id), null, 2));
  },
};

async function supabaseStore(): Promise<Store> {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user || !isAllowedEmail(data.user.email)) throw new Unauthorized();
  const userId = data.user.id;

  const toBill = (row: { id: string; data: ExtractedBill; extracted_by: Bill["extractedBy"]; pdf_path: string | null; created_at: string }): Bill => ({
    ...row.data,
    id: row.id,
    extractedBy: row.extracted_by,
    pdfPath: row.pdf_path,
    createdAt: row.created_at,
  });

  return {
    async list() {
      const { data, error } = await sb.from("bills").select("*").order("bill_date");
      if (error) throw error;
      return data.map(toBill);
    },
    async get(id) {
      const { data, error } = await sb.from("bills").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? toBill(data) : null;
    },
    async add(extracted, extractedBy, pdf) {
      const id = randomUUID();
      const pdfPath = `${userId}/${id}.pdf`;
      const up = await sb.storage.from("bills").upload(pdfPath, pdf, { contentType: "application/pdf" });
      if (up.error) throw up.error;
      const { data, error } = await sb
        .from("bills")
        .insert({ id, user_id: userId, data: extracted, extracted_by: extractedBy, pdf_path: pdfPath, provider: extracted.provider, account_no: extracted.accountNo, bill_date: extracted.billDate })
        .select()
        .single();
      if (error) throw error;
      return toBill(data);
    },
    async remove(id) {
      const { data } = await sb.from("bills").select("pdf_path").eq("id", id).maybeSingle();
      if (data?.pdf_path) await sb.storage.from("bills").remove([data.pdf_path]);
      const { error } = await sb.from("bills").delete().eq("id", id);
      if (error) throw error;
    },
  };
}
