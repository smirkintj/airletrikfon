import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { authEnabled, currentUser } from "./auth";
import { PROVIDERS, type Bill, type ExtractedBill } from "./types";

/**
 * Bills live in Neon when it's configured: rows in Postgres, original PDFs in the
 * category's private bucket. Otherwise they live in `.data/` on local disk (git-ignored).
 * Local mode has no login, so it refuses to run on Vercel.
 */
export interface Store {
  list(): Promise<Bill[]>;
  get(id: string): Promise<Bill | null>;
  add(bill: ExtractedBill, extractedBy: Bill["extractedBy"], pdf: Buffer): Promise<Bill>;
  remove(id: string): Promise<void>;
}

export class Unauthorized extends Error {}
export class NotConfigured extends Error {}

export async function getStore(): Promise<Store> {
  if (process.env.DATABASE_URL) {
    if (!authEnabled()) throw new NotConfigured("DATABASE_URL is set but Neon Auth isn't configured. Refusing to serve bills without a login.");
    return neonStore();
  }
  if (process.env.VERCEL) throw new NotConfigured("Neon isn't configured. Refusing to serve bills without a login.");
  return localStore;
}

// ─── Local ──────────────────────────────────────────────────────────────────────────────

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

// ─── Neon ───────────────────────────────────────────────────────────────────────────────

const BUCKETS = { electricity: "electricbill", water: "waterbill", telco: "phonebill", other: "phonebill" } as const;
const bucketFor = (provider: Bill["provider"]) => BUCKETS[PROVIDERS[provider].category];

let pool: Pool | null = null;
let s3: S3Client | null = null;
let schema: Promise<unknown> | null = null;

function db() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    attachDatabasePool(pool);
  }
  // One small table, so it's created on first use instead of via a migration tool.
  schema ??= pool.query(`
    create table if not exists bills (
      id uuid primary key,
      user_id text not null,
      provider text not null,
      account_no text not null,
      bill_date date not null,
      data jsonb not null,
      extracted_by text not null,
      pdf_key text,
      created_at timestamptz not null default now()
    );
    create index if not exists bills_user_date on bills (user_id, bill_date);
  `);
  return { pool, ready: schema };
}

// Credentials, endpoint and region come from the AWS_* variables Neon provides.
const storage = () => (s3 ??= new S3Client({ forcePathStyle: true }));

type Row = { id: string; data: ExtractedBill; extracted_by: Bill["extractedBy"]; pdf_key: string | null; created_at: Date };
const toBill = (r: Row): Bill => ({ ...r.data, id: r.id, extractedBy: r.extracted_by, pdfPath: r.pdf_key, createdAt: r.created_at.toISOString() });

async function neonStore(): Promise<Store> {
  const user = await currentUser();
  if (!user) throw new Unauthorized();
  const { pool, ready } = db();
  await ready;

  return {
    async list() {
      const { rows } = await pool.query<Row>("select * from bills where user_id = $1 order by bill_date", [user.id]);
      return rows.map(toBill);
    },
    async get(id) {
      const { rows } = await pool.query<Row>("select * from bills where id = $1 and user_id = $2", [id, user.id]);
      return rows[0] ? toBill(rows[0]) : null;
    },
    async add(extracted, extractedBy, pdf) {
      const id = randomUUID();
      const key = `${user.id}/${id}.pdf`;
      await storage().send(new PutObjectCommand({ Bucket: bucketFor(extracted.provider), Key: key, Body: pdf, ContentType: "application/pdf" }));
      const { rows } = await pool.query<Row>(
        `insert into bills (id, user_id, provider, account_no, bill_date, data, extracted_by, pdf_key)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
        [id, user.id, extracted.provider, extracted.accountNo, extracted.billDate, JSON.stringify(extracted), extractedBy, key],
      );
      return toBill(rows[0]);
    },
    async remove(id) {
      const { rows } = await pool.query<Row>("delete from bills where id = $1 and user_id = $2 returning *", [id, user.id]);
      const bill = rows[0];
      if (bill?.pdf_key) await storage().send(new DeleteObjectCommand({ Bucket: bucketFor(bill.data.provider), Key: bill.pdf_key }));
    },
  };
}
