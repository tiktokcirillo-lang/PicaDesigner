import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type {
  CampaignFamilyAuthority,
  CampaignFamilyExportSession,
  CampaignFamilyRepository,
  CampaignVariantFamily,
} from "../../domain/campaign-variants/index.js";
export interface MockCampaignDatabase {
  families: CampaignVariantFamily[];
  authorities: CampaignFamilyAuthority[];
  exports: CampaignFamilyExportSession[];
  available: boolean;
}
export const createMockCampaignDatabase = (): MockCampaignDatabase => ({
  families: [],
  authorities: [],
  exports: [],
  available: true,
});
const clone = <T>(x: T): T => structuredClone(x);
export class MockCampaignFamilyRepository implements CampaignFamilyRepository {
  constructor(private db = createMockCampaignDatabase()) {}
  private ready() {
    if (!this.db.available)
      throw new Error("Campaign persistence unavailable.");
  }
  async create(family: CampaignVariantFamily) {
    this.ready();
    const prior = this.db.families.find(
      (x) =>
        x.projectId === family.projectId &&
        x.operationId === family.operationId,
    );
    if (prior) {
      if (prior.inputFingerprint !== family.inputFingerprint)
        throw new Error("Campaign operation conflict.");
      return clone(prior);
    }
    this.db.families.push(clone(family));
    return clone(family);
  }
  async save(family: CampaignVariantFamily, expectedRevision: number) {
    this.ready();
    const index = this.db.families.findIndex(
      (x) => x.projectId === family.projectId && x.familyId === family.familyId,
    );
    if (index < 0) throw new Error("Campaign family not found.");
    if (this.db.families[index]!.revision !== expectedRevision)
      throw new Error("Campaign revision conflict.");
    const saved = { ...clone(family), revision: expectedRevision + 1 };
    this.db.families[index] = saved;
    return clone(saved);
  }
  async get(projectId: string, familyId: string) {
    this.ready();
    const x = this.db.families.find(
      (x) => x.projectId === projectId && x.familyId === familyId,
    );
    return x ? clone(x) : undefined;
  }
  async findByOperation(projectId: string, operationId: string) {
    this.ready();
    const x = this.db.families.find(
      (x) => x.projectId === projectId && x.operationId === operationId,
    );
    return x ? clone(x) : undefined;
  }
  async latest(projectId: string) {
    this.ready();
    const x = this.db.families
      .filter((x) => x.projectId === projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return x ? clone(x) : undefined;
  }
  async saveAuthority(authority: CampaignFamilyAuthority) {
    this.ready();
    const prior = this.db.authorities.find(
      (x) =>
        x.projectId === authority.projectId &&
        x.operationId === authority.operationId,
    );
    if (prior) return clone(prior);
    this.db.authorities.push(clone(authority));
    return clone(authority);
  }
  async approve(
    family: CampaignVariantFamily,
    authority: CampaignFamilyAuthority,
    expectedRevision: number,
  ) {
    this.ready();
    const index = this.db.families.findIndex(
      (x) => x.projectId === family.projectId && x.familyId === family.familyId,
    );
    if (index < 0 || this.db.families[index]!.revision !== expectedRevision)
      throw new Error("Campaign revision conflict.");
    const duplicate = this.db.authorities.find(
      (x) =>
        x.projectId === authority.projectId &&
        x.operationId === authority.operationId,
    );
    const savedAuthority = duplicate ?? clone(authority);
    if (!duplicate) this.db.authorities.push(savedAuthority);
    const savedFamily = { ...clone(family), revision: expectedRevision + 1 };
    this.db.families[index] = savedFamily;
    return { family: clone(savedFamily), authority: clone(savedAuthority) };
  }
  async getAuthority(projectId: string, id: string) {
    this.ready();
    const x = this.db.authorities.find(
      (x) => x.projectId === projectId && x.familyAuthorityId === id,
    );
    return x ? clone(x) : undefined;
  }
  async saveExport(session: CampaignFamilyExportSession) {
    this.ready();
    const prior = this.db.exports.find(
      (x) =>
        x.projectId === session.projectId &&
        x.operationId === session.operationId,
    );
    if (prior) {
      if (session.status === "unavailable" || prior.status === "unavailable") {
        this.db.exports[this.db.exports.indexOf(prior)] = clone(session);
        return clone(session);
      }
      return clone(prior);
    }
    this.db.exports.push(clone(session));
    return clone(session);
  }
  async getExport(projectId: string, id: string) {
    this.ready();
    const found = this.db.exports.find(
      (x) => x.projectId === projectId && x.exportSessionId === id,
    );
    return found ? clone(found) : undefined;
  }
  async listExports(projectId: string, familyId?: string) {
    this.ready();
    return clone(
      this.db.exports.filter(
        (x) =>
          x.projectId === projectId && (!familyId || x.familyId === familyId),
      ),
    );
  }
  async health() {
    return {
      status: this.db.available ? ("ok" as const) : ("degraded" as const),
      kind: "durable" as const,
    };
  }
}
type Row = Record<string, unknown>;
const familyFrom = (row: Row) => row.family_snapshot as CampaignVariantFamily,
  authorityFrom = (row: Row) =>
    row.authority_snapshot as CampaignFamilyAuthority,
  exportFrom = (row: Row) =>
    row.artifact_metadata as CampaignFamilyExportSession;
export class NeonCampaignFamilyRepository implements CampaignFamilyRepository {
  private sql: NeonQueryFunction<false, false>;
  constructor(url: string) {
    this.sql = neon(url);
  }
  async create(f: CampaignVariantFamily, expected: number) {
    const project = await this.sql.query(
      "UPDATE projects SET revision=revision+1,updated_at=now() WHERE project_id=$1 AND revision=$2 RETURNING project_id",
      [f.projectId, expected],
    );
    if (!project.length) throw new Error("Campaign project revision conflict.");
    const rows = await this.sql.query(
      "INSERT INTO campaign_variant_families(family_id,project_id,operation_id,input_fingerprint,family_definition_id,primary_format_id,status,invariants,family_snapshot,revision,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12) ON CONFLICT(project_id,operation_id) DO UPDATE SET operation_id=EXCLUDED.operation_id RETURNING *",
      [
        f.familyId,
        f.projectId,
        f.operationId,
        f.inputFingerprint,
        f.familyDefinitionId,
        f.primaryFormatId,
        f.status,
        JSON.stringify(f.invariants),
        JSON.stringify(f),
        f.revision,
        f.createdAt,
        f.updatedAt,
      ],
    );
    for (const v of f.variants)
      await this.sql.query(
        "INSERT INTO campaign_variants(variant_id,family_id,project_id,format_id,width,height,status,input_fingerprint,metadata,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) ON CONFLICT(family_id,format_id) DO NOTHING",
        [
          v.variantId,
          f.familyId,
          f.projectId,
          v.formatId,
          v.width,
          v.height,
          v.status,
          v.inputFingerprint,
          JSON.stringify(v),
          v.createdAt,
          v.updatedAt,
        ],
      );
    return familyFrom(rows[0] as Row);
  }
  async save(f: CampaignVariantFamily, expected: number) {
    const saved = { ...f, revision: expected + 1 };
    const rows = await this.sql.query(
      "UPDATE campaign_variant_families SET status=$3,family_snapshot=$4::jsonb,revision=revision+1,updated_at=$5 WHERE project_id=$1 AND family_id=$2 AND revision=$6 RETURNING *",
      [
        f.projectId,
        f.familyId,
        f.status,
        JSON.stringify(saved),
        f.updatedAt,
        expected,
      ],
    );
    if (!rows.length) throw new Error("Campaign revision conflict.");
    for (const v of f.variants)
      await this.sql.query(
        "UPDATE campaign_variants SET status=$3,layout_session_id=$4,review_session_id=$5,render_session_id=$6,image_asset_session_id=$7,post_render_review_session_id=$8,production_authority_id=$9,metadata=$10::jsonb,updated_at=$11 WHERE family_id=$1 AND variant_id=$2",
        [
          f.familyId,
          v.variantId,
          v.status,
          v.layoutSessionId,
          v.reviewSessionId,
          v.renderSessionId,
          v.imageAssetSessionId,
          v.postRenderReviewSessionId,
          v.productionAuthorityId,
          JSON.stringify(v),
          v.updatedAt,
        ],
      );
    return familyFrom(rows[0] as Row);
  }
  async get(projectId: string, id: string) {
    const r = await this.sql.query(
      "SELECT * FROM campaign_variant_families WHERE project_id=$1 AND family_id=$2",
      [projectId, id],
    );
    return r[0] ? familyFrom(r[0] as Row) : undefined;
  }
  async findByOperation(projectId: string, id: string) {
    const r = await this.sql.query(
      "SELECT * FROM campaign_variant_families WHERE project_id=$1 AND operation_id=$2",
      [projectId, id],
    );
    return r[0] ? familyFrom(r[0] as Row) : undefined;
  }
  async latest(projectId: string) {
    const r = await this.sql.query(
      "SELECT * FROM campaign_variant_families WHERE project_id=$1 ORDER BY updated_at DESC LIMIT 1",
      [projectId],
    );
    return r[0] ? familyFrom(r[0] as Row) : undefined;
  }
  async saveAuthority(a: CampaignFamilyAuthority) {
    const rows = await this.sql.query(
      "INSERT INTO campaign_family_authorities(family_authority_id,family_id,project_id,operation_id,fingerprint,variant_authority_ids,status,authority_snapshot,created_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9) ON CONFLICT(project_id,operation_id) DO UPDATE SET operation_id=EXCLUDED.operation_id RETURNING *",
      [
        a.familyAuthorityId,
        a.familyId,
        a.projectId,
        a.operationId,
        a.fingerprint,
        JSON.stringify(a.variantAuthorityIds),
        a.status,
        JSON.stringify(a),
        a.approvedAt,
      ],
    );
    await this.sql.query(
      "UPDATE projects SET latest_campaign_family_authority_id=$2,updated_at=now() WHERE project_id=$1",
      [a.projectId, a.familyAuthorityId],
    );
    return authorityFrom(rows[0] as Row);
  }
  async approve(
    f: CampaignVariantFamily,
    a: CampaignFamilyAuthority,
    expected: number,
  ) {
    const saved = { ...f, revision: expected + 1 };
    const rows = await this.sql.query(
      "WITH locked AS (SELECT family_id FROM campaign_variant_families WHERE project_id=$1 AND family_id=$2 AND revision=$3 FOR UPDATE), authority AS (INSERT INTO campaign_family_authorities(family_authority_id,family_id,project_id,operation_id,fingerprint,variant_authority_ids,status,authority_snapshot,created_at) SELECT $4,$2,$1,$5,$6,$7::jsonb,$8,$9::jsonb,$10 FROM locked ON CONFLICT(project_id,operation_id) DO UPDATE SET operation_id=EXCLUDED.operation_id RETURNING *), variants AS (UPDATE campaign_variants cv SET production_authority_id=a.value,status='approved',updated_at=$10 FROM jsonb_each_text($7::jsonb) a WHERE cv.family_id=$2 AND cv.format_id=a.key), family AS (UPDATE campaign_variant_families SET status='approved',family_snapshot=$11::jsonb,revision=revision+1,updated_at=$10 WHERE family_id IN (SELECT family_id FROM locked) RETURNING *), project AS (UPDATE projects SET latest_campaign_family_authority_id=$4,updated_at=now() WHERE project_id=$1 AND EXISTS(SELECT 1 FROM family)) SELECT (SELECT authority_snapshot FROM authority) authority_snapshot,(SELECT family_snapshot FROM family) family_snapshot",
      [
        f.projectId,
        f.familyId,
        expected,
        a.familyAuthorityId,
        a.operationId,
        a.fingerprint,
        JSON.stringify(a.variantAuthorityIds),
        a.status,
        JSON.stringify(a),
        a.approvedAt,
        JSON.stringify(saved),
      ],
    );
    if (!rows[0]?.family_snapshot || !rows[0]?.authority_snapshot)
      throw new Error("Campaign revision conflict.");
    return {
      family: familyFrom(rows[0] as Row),
      authority: authorityFrom(rows[0] as Row),
    };
  }
  async getAuthority(projectId: string, id: string) {
    const r = await this.sql.query(
      "SELECT * FROM campaign_family_authorities WHERE project_id=$1 AND family_authority_id=$2",
      [projectId, id],
    );
    return r[0] ? authorityFrom(r[0] as Row) : undefined;
  }
  async saveExport(session: CampaignFamilyExportSession) {
    const rows = await this.sql.query(
      "INSERT INTO campaign_family_export_sessions(export_session_id,family_authority_id,family_id,project_id,operation_id,input_fingerprint,status,artifact_metadata,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) ON CONFLICT(project_id,operation_id) DO UPDATE SET status=CASE WHEN EXCLUDED.status='unavailable' OR campaign_family_export_sessions.status='unavailable' THEN EXCLUDED.status ELSE campaign_family_export_sessions.status END,artifact_metadata=CASE WHEN EXCLUDED.status='unavailable' OR campaign_family_export_sessions.status='unavailable' THEN EXCLUDED.artifact_metadata ELSE campaign_family_export_sessions.artifact_metadata END RETURNING *",
      [
        session.exportSessionId,
        session.familyAuthorityId,
        session.familyId,
        session.projectId,
        session.operationId,
        session.inputFingerprint,
        session.status,
        JSON.stringify(session),
        session.createdAt,
      ],
    );
    return exportFrom(rows[0] as Row);
  }
  async getExport(projectId: string, id: string) {
    const rows = await this.sql.query(
      "SELECT * FROM campaign_family_export_sessions WHERE project_id=$1 AND export_session_id=$2",
      [projectId, id],
    );
    return rows[0] ? exportFrom(rows[0] as Row) : undefined;
  }
  async listExports(projectId: string, familyId?: string) {
    const rows = await this.sql.query(
      familyId
        ? "SELECT * FROM campaign_family_export_sessions WHERE project_id=$1 AND family_id=$2 ORDER BY created_at DESC"
        : "SELECT * FROM campaign_family_export_sessions WHERE project_id=$1 ORDER BY created_at DESC",
      familyId ? [projectId, familyId] : [projectId],
    );
    return rows.map((row) => exportFrom(row as Row));
  }
  async health() {
    try {
      await this.sql.query("SELECT 1");
      return { status: "ok" as const, kind: "durable" as const };
    } catch {
      return { status: "degraded" as const, kind: "durable" as const };
    }
  }
}
