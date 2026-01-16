import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* -------------------- STORAGE -------------------- */
const upload = multer({ dest: "uploads/" });
const OUTPUT_DIR = "outputs";

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

/* -------------------- HEALTH CHECK -------------------- */
app.get("/", (req, res) => {
  res.send("🎬 Video + Audio Merge API is running 🚀");
});

/* ====================================================
   🎵 PIXABAY MUSIC SEARCH (RETURNS TWO URLS)
   ==================================================== */
app.get("/pixabay-music", async (req, res) => {
  try {
    const q = req.query.q || "cinematic";

    const r = await fetch(
      `https://pixabay.com/api/music/?key=${process.env.PIXABAY_KEY}&q=${encodeURIComponent(
        q
      )}`
    );

    const data = await r.json();

    res.json(
      data.hits.map(track => ({
        id: track.id,
        title: track.tags,
        duration: track.duration,

        // Browser preview (proxied)
        previewUrl: `/pixabay-audio?url=${encodeURIComponent(track.audio)}`,

        // FFmpeg-safe direct URL (IMPORTANT)
        downloadUrl: track.audio
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Pixabay search failed" });
  }
});

/* ====================================================
   🔊 PIXABAY AUDIO PREVIEW PROXY (BROWSER ONLY)
   ==================================================== */
app.get("/pixabay-audio", async (req, res) => {
  try {
    const audioUrl = req.query.url;
    if (!audioUrl) return res.status(400).send("Missing audio URL");

    const r = await fetch(audioUrl);
    res.setHeader("Content-Type", "audio/mpeg");
    r.body.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to fetch audio");
  }
});

/* ====================================================
   🎬 VIDEO + AUDIO MERGE (FFMPEG)
   ==================================================== */
app.post(
  "/merge",
  upload.fields([
    { name: "videos", maxCount: 1 },
    { name: "audios", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      if (!req.files?.videos) {
        return res.status(400).json({ error: "Video required" });
      }

      const videoPath = req.files.videos[0].path;
      const audioFile = req.files.audios?.[0];
      const audioUrl = req.body.audioUrl; // CDN URL from Pixabay
      const outputPath = path.join(
        OUTPUT_DIR,
        `final_${Date.now()}.mp4`
      );

      let ffmpegCmd;

      // ✅ PRIORITY: direct CDN URL
      if (audioUrl) {
        ffmpegCmd = `ffmpeg -y -i "${videoPath}" -i "${audioUrl}" \
-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest "${outputPath}"`;
      }

      // fallback: uploaded audio file
      else if (audioFile) {
        ffmpegCmd = `ffmpeg -y -i "${videoPath}" -i "${audioFile.path}" \
-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest "${outputPath}"`;
      }

      // video only
      else {
        ffmpegCmd = `ffmpeg -y -i "${videoPath}" -c copy "${outputPath}"`;
      }

      exec(ffmpegCmd, err => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Merge failed" });
        }

        res.download(outputPath, () => {
          fs.unlinkSync(videoPath);
          if (audioFile) fs.unlinkSync(audioFile.path);
        });
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

/* -------------------- START SERVER -------------------- */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
