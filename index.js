import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import cors from "cors";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const app = express();

/* =========================
   CORS (REQUIRED FOR MEDO)
========================= */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

const PORT = process.env.PORT || 3000;

/* =========================
   UPLOAD CONFIG
========================= */
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

/* =========================
   ROOT
========================= */
app.get("/", (req, res) => {
  res.send("🎬 Video + Audio Merge API is running 🚀");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* =========================
   PIXABAY AUDIO PROXY (PREVIEW)
========================= */
app.get("/pixabay-audio", async (req, res) => {
  try {
    const audioUrl = req.query.url;
    if (!audioUrl || !audioUrl.endsWith(".mp3")) {
      return res.status(400).json({ error: "Invalid audio URL" });
    }

    const response = await fetch(audioUrl);
    if (!response.ok) {
      return res.status(500).json({ error: "Failed to fetch audio" });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    response.body.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Audio proxy failed" });
  }
});

/* =========================
   HELPER: DOWNLOAD AUDIO
========================= */
async function downloadAudio(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Audio download failed");

  const stream = fs.createWriteStream(outputPath);
  await new Promise((resolve, reject) => {
    response.body.pipe(stream);
    response.body.on("error", reject);
    stream.on("finish", resolve);
  });
}

/* =========================
   MERGE ROUTE (FINAL FIX)
========================= */
app.post(
  "/merge",
  upload.fields([
    { name: "videos", maxCount: 10 },
    { name: "audios", maxCount: 2 }
  ]),
  async (req, res) => {
    try {
      if (!req.files?.videos) {
        return res.status(400).json({ error: "Videos required" });
      }

      const videos = req.files.videos.map(v => v.path);
      let audioFiles = [];

      /* ---- CASE 1: AUDIO FILE UPLOAD ---- */
      if (req.files.audios) {
        audioFiles = req.files.audios.map(a => a.path);
      }

      /* ---- CASE 2: PIXABAY AUDIO URL ---- */
      if (req.body.audioUrl) {
        const audioPath = `uploads/pixabay_${Date.now()}.mp3`;
        await downloadAudio(req.body.audioUrl, audioPath);
        audioFiles.push(audioPath);
      }

      if (audioFiles.length === 0) {
        return res.status(400).json({ error: "Audio required" });
      }

      /* ---- FILES ---- */
      const videoListFile = "videos.txt";
      const mergedVideo = "merged_video.mp4";
      const mixedAudio = "mixed_audio.mp3";
      const outputFile = "final_output.mp4";

      fs.writeFileSync(
        videoListFile,
        videos.map(v => `file '${path.resolve(v)}'`).join("\n")
      );

      /* ---- MERGE VIDEOS ---- */
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(videoListFile)
          .inputOptions(["-f concat", "-safe 0"])
          .outputOptions(["-c copy"])
          .save(mergedVideo)
          .on("end", resolve)
          .on("error", reject);
      });

      /* ---- MIX AUDIO ---- */
      await new Promise((resolve, reject) => {
        const cmd = ffmpeg();
        audioFiles.forEach(a => cmd.input(a));

        cmd
          .complexFilter([`amix=inputs=${audioFiles.length}:dropout_transition=2`])
          .save(mixedAudio)
          .on("end", resolve)
          .on("error", reject);
      });

      /* ---- FINAL MERGE ---- */
      ffmpeg(mergedVideo)
        .input(mixedAudio)
        .outputOptions(["-c:v copy", "-c:a aac", "-shortest"])
        .save(outputFile)
        .on("end", () => {
          res.download(outputFile, () => {
            [
              ...videos,
              ...audioFiles,
              videoListFile,
              mergedVideo,
              mixedAudio,
              outputFile
            ].forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
          });
        })
        .on("error", err => {
          console.error(err);
          res.status(500).json({ error: err.message });
        });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
