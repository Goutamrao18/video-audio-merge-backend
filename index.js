import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { v2 as cloudinary } from "cloudinary";

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Cloudinary config
cloudinary.config({
  cloudinary_url: process.env.CLOUDINARY_URL,
});

// Health check
app.get("/", (req, res) => {
  res.send("✅ Video + Audio Merge Backend Running");
});

/**
 * 1️⃣ GET Cloudinary background music
 */
app.get("/cloud-music", async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression("resource_type:video AND folder:background-music")
      .sort_by("created_at", "desc")
      .max_results(50)
      .execute();

    const songs = result.resources.map((file) => ({
      id: file.public_id,
      title: file.public_id.split("/").pop(),
      duration: Math.round(file.duration || 0),
      previewUrl: file.secure_url,
      downloadUrl: file.secure_url,
    }));

    res.json(songs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load cloud music" });
  }
});

/**
 * 2️⃣ MERGE VIDEO + AUDIO (REAL MERGE)
 */
app.post("/merge", async (req, res) => {
  const { videoUrl, audioUrl } = req.body;

  if (!videoUrl || !audioUrl) {
    return res.status(400).json({ error: "videoUrl & audioUrl required" });
  }

  const tempDir = "./tmp";
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  const videoPath = path.join(tempDir, "video.mp4");
  const audioPath = path.join(tempDir, "audio.mp3");
  const outputPath = path.join(tempDir, "final.mp4");

  try {
    // Download video
    const videoRes = await fetch(videoUrl);
    fs.writeFileSync(videoPath, Buffer.from(await videoRes.arrayBuffer()));

    // Download audio
    const audioRes = await fetch(audioUrl);
    fs.writeFileSync(audioPath, Buffer.from(await audioRes.arrayBuffer()));

    // Merge using FFmpeg
    ffmpeg(videoPath)
      .input(audioPath)
      .outputOptions([
        "-c:v copy",
        "-c:a aac",
        "-shortest",
      ])
      .save(outputPath)
      .on("end", async () => {
        // Upload merged video to Cloudinary
        const upload = await cloudinary.uploader.upload(outputPath, {
          resource_type: "video",
          folder: "merged-videos",
        });

        // Cleanup
        fs.unlinkSync(videoPath);
        fs.unlinkSync(audioPath);
        fs.unlinkSync(outputPath);

        res.json({
          success: true,
          mergedVideoUrl: upload.secure_url,
        });
      })
      .on("error", (err) => {
        console.error(err);
        res.status(500).json({ error: "Merge failed" });
      });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Processing error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
