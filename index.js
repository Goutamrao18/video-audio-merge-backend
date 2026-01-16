import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { v2 as cloudinary } from "cloudinary";

const app = express();
app.use(cors());
app.use(express.json());

// Cloudinary config (SAFE: uses env)
cloudinary.config({
  cloudinary_url: process.env.CLOUDINARY_URL
});

app.get("/", (req, res) => {
  res.send("Video + Audio Merge API running 🚀");
});

/**
 * 1️⃣ List cloud music (from Cloudinary folder)
 */
app.get("/cloud-music", async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression("resource_type:video AND folder:background-music")
      .sort_by("created_at", "desc")
      .max_results(20)
      .execute();

    const songs = result.resources.map(file => ({
      id: file.public_id,
      title: file.public_id.split("/").pop(),
      duration: Math.round(file.duration),
      previewUrl: file.secure_url,
      downloadUrl: file.secure_url
    }));

    res.json(songs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load cloud music" });
  }
});

/**
 * 2️⃣ Merge video + cloud audio (FFmpeg-ready)
 * (You already have this logic — just pass downloadUrl)
 */
app.post("/merge", async (req, res) => {
  const { videoUrl, audioUrl } = req.body;

  if (!videoUrl || !audioUrl) {
    return res.status(400).json({ error: "Missing URLs" });
  }

  // Your existing FFmpeg merge logic goes here
  res.json({
    success: true,
    message: "Merge started",
    videoUrl,
    audioUrl
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
