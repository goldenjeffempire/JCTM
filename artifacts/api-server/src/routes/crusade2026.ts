import { Router, type IRouter } from "express";
import multer from "multer";
import sharp from "sharp";
import rateLimit from "express-rate-limit";
import { requireAdminRole } from "../lib/adminAuth.js";
import { ObjectStorageService, detectImageMimeType } from "../lib/objectStorage.js";
import { crusadeCampaignInput, readCrusadeCampaign, publicCrusade, updateCrusadeCampaign } from "../lib/crusade-campaign.js";

const router: IRouter = Router();
const admin = requireAdminRole("livestream");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const uploadLimit = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });

router.use("/crusade-2026", (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
router.get("/crusade-2026", async (req, res) => {
  try {
    const campaign = publicCrusade(await readCrusadeCampaign());
    if (!campaign) { res.status(404).json({ error: "This event is not currently published" }); return; }
    res.json(campaign);
  } catch (error) {
    req.log.error({ err: error }, "Unable to read crusade campaign");
    res.status(503).json({ error: "Event information is temporarily unavailable. Please try again." });
  }
});
router.get("/crusade-2026/admin", admin, async (req, res) => {
  try { res.json(await readCrusadeCampaign()); }
  catch (error) {
    req.log.error({ err: error }, "Unable to read admin crusade campaign");
    res.status(503).json({ error: "Unable to load event settings" });
  }
});
router.put("/crusade-2026/admin", admin, async (req, res) => {
  const parsed = crusadeCampaignInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") }); return; }
  try {
    const result = await updateCrusadeCampaign(parsed.data);
    if (!result) { res.status(409).json({ error: "Another administrator updated this event. Reload before saving." }); return; }
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "Unable to save crusade campaign");
    res.status(503).json({ error: "The event could not be saved. Your edits have not been published." });
  }
});
router.post("/crusade-2026/admin/flyer", admin, uploadLimit, (req, res) => {
  upload.single("flyer")(req, res, async error => {
    if (error) { res.status(400).json({ error: "Upload one image, no larger than 10 MB." }); return; }
    if (!req.file || !detectImageMimeType(req.file.buffer)) {
      res.status(400).json({ error: "Choose a valid JPG, PNG or WebP image." }); return;
    }
    try {
      const buffer = await sharp(req.file.buffer, { limitInputPixels: 40_000_000 })
        .rotate().resize({ width: 2048, withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
      const objectPath = await new ObjectStorageService().uploadBuffer(buffer, "image/webp");
      res.status(201).json({ flyerUrl: `/api/storage${objectPath}` });
    } catch (err) {
      req.log.error({ err }, "Unable to upload crusade flyer");
      res.status(503).json({ error: "Flyer upload failed. The existing flyer has not changed." });
    }
  });
});
export default router;
