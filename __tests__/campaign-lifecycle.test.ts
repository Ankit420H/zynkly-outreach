import {
  canTransition,
  getNextStates,
  isTerminal,
  isActive,
} from "@/lib/campaigns/lifecycle";
import { CampaignStatus } from "@prisma/client";

describe("Campaign Lifecycle State Machine", () => {
  describe("canTransition", () => {
    it("allows DRAFT → DRY_RUN", () => {
      expect(canTransition(CampaignStatus.DRAFT, CampaignStatus.DRY_RUN)).toBe(true);
    });

    it("allows DRY_RUN → READY", () => {
      expect(canTransition(CampaignStatus.DRY_RUN, CampaignStatus.READY)).toBe(true);
    });

    it("allows READY → QUEUED", () => {
      expect(canTransition(CampaignStatus.READY, CampaignStatus.QUEUED)).toBe(true);
    });

    it("allows QUEUED → SENDING", () => {
      expect(canTransition(CampaignStatus.QUEUED, CampaignStatus.SENDING)).toBe(true);
    });

    it("allows SENDING → PAUSED", () => {
      expect(canTransition(CampaignStatus.SENDING, CampaignStatus.PAUSED)).toBe(true);
    });

    it("allows PAUSED → SENDING", () => {
      expect(canTransition(CampaignStatus.PAUSED, CampaignStatus.SENDING)).toBe(true);
    });

    it("allows SENDING → COMPLETED", () => {
      expect(canTransition(CampaignStatus.SENDING, CampaignStatus.COMPLETED)).toBe(true);
    });

    it("allows COMPLETED → ARCHIVED", () => {
      expect(canTransition(CampaignStatus.COMPLETED, CampaignStatus.ARCHIVED)).toBe(true);
    });

    it("blocks DRAFT → SENDING (skip steps)", () => {
      expect(canTransition(CampaignStatus.DRAFT, CampaignStatus.SENDING)).toBe(false);
    });

    it("blocks ARCHIVED → anything", () => {
      Object.values(CampaignStatus).forEach((status) => {
        expect(canTransition(CampaignStatus.ARCHIVED, status)).toBe(false);
      });
    });

    it("blocks COMPLETED → SENDING", () => {
      expect(canTransition(CampaignStatus.COMPLETED, CampaignStatus.SENDING)).toBe(false);
    });
  });

  describe("isTerminal", () => {
    it("returns true for ARCHIVED", () => {
      expect(isTerminal(CampaignStatus.ARCHIVED)).toBe(true);
    });

    it("returns false for all other statuses", () => {
      const others = Object.values(CampaignStatus).filter(
        (s) => s !== CampaignStatus.ARCHIVED
      );
      others.forEach((s) => expect(isTerminal(s)).toBe(false));
    });
  });

  describe("isActive", () => {
    it("returns true for SENDING and QUEUED", () => {
      expect(isActive(CampaignStatus.SENDING)).toBe(true);
      expect(isActive(CampaignStatus.QUEUED)).toBe(true);
    });

    it("returns false for all others", () => {
      const others = Object.values(CampaignStatus).filter(
        (s) => s !== CampaignStatus.SENDING && s !== CampaignStatus.QUEUED
      );
      others.forEach((s) => expect(isActive(s)).toBe(false));
    });
  });

  describe("getNextStates", () => {
    it("returns correct next states for DRAFT", () => {
      expect(getNextStates(CampaignStatus.DRAFT)).toEqual([CampaignStatus.DRY_RUN]);
    });

    it("returns empty array for ARCHIVED", () => {
      expect(getNextStates(CampaignStatus.ARCHIVED)).toEqual([]);
    });
  });
});
