import type { CampaignFamilyRepository } from "../../domain/campaign-variants/index.js";
import {
  createMockCampaignDatabase,
  MockCampaignFamilyRepository,
  NeonCampaignFamilyRepository,
} from "./repository.js";
export * from "./repository.js";
class UnavailableCampaignRepository {
  private fail(): never {
    throw new Error("Durable campaign persistence unavailable.");
  }
  create() {
    return this.fail();
  }
  save() {
    return this.fail();
  }
  get() {
    return this.fail();
  }
  findByOperation() {
    return this.fail();
  }
  latest() {
    return this.fail();
  }
  approve() {
    return this.fail();
  }
  saveAuthority() {
    return this.fail();
  }
  getAuthority() {
    return this.fail();
  }
  saveExport() {
    return this.fail();
  }
  getExport() {
    return this.fail();
  }
  listExports() {
    return this.fail();
  }
  async health() {
    return { status: "degraded" as const, kind: "unavailable" as const };
  }
}
export const createCampaignFamilyRepository = (
  env: NodeJS.ProcessEnv = process.env,
): CampaignFamilyRepository =>
  env.DATABASE_URL
    ? new NeonCampaignFamilyRepository(env.DATABASE_URL)
    : env.NODE_ENV !== "production"
      ? new MockCampaignFamilyRepository(createMockCampaignDatabase())
      : (new UnavailableCampaignRepository() as CampaignFamilyRepository);
export const applicationCampaignFamilyRepository =
  createCampaignFamilyRepository();
