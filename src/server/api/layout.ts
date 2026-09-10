import { Router } from "express";
import {
  createLayoutIntelligence,
  type CreateLayoutIntelligenceRequest,
} from "../../application/layout-intelligence/index.js";
import { renderLayoutDebugWireframe } from "../../domain/layout-engine/index.js";
export const createLayoutRouter = (): Router => {
  const router = Router();
  router.post("/plan", (request, response) => {
    try {
      const body = request.body as Partial<CreateLayoutIntelligenceRequest>;
      if (
        !body.projectId ||
        !body.creativeDirection ||
        !body.format ||
        !body.destinationTool
      )
        return response
          .status(400)
          .json({
            error:
              "projectId, creativeDirection, format and destinationTool are required",
          });
      const session = createLayoutIntelligence(
        body as CreateLayoutIntelligenceRequest,
      );
      return response
        .status(session.status === "failed" ? 422 : 200)
        .json(session);
    } catch (error) {
      return response
        .status(422)
        .json({
          error:
            error instanceof Error ? error.message : "Layout planning failed.",
        });
    }
  });
  router.post("/debug", (request, response) => {
    try {
      const session = createLayoutIntelligence(
          request.body as CreateLayoutIntelligenceRequest,
        ),
        plan = session.layoutDocument?.frames[0];
      if (!plan)
        return response
          .status(422)
          .json({ error: session.failureReason ?? "No eligible layout." });
      return response
        .type("image/svg+xml")
        .send(renderLayoutDebugWireframe(plan));
    } catch (error) {
      return response
        .status(422)
        .json({
          error:
            error instanceof Error ? error.message : "Layout debug failed.",
        });
    }
  });
  return router;
};
