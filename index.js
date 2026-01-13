import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";

const app = express();
const upload = multer({ dest: "uploads/" });

app.post(
  "/merge",
  upload.fields([
    { name: "videos", maxCount: 5 },
    { name: "audios", maxCount: 5 }
  ]),
  async (req, res) => {
    const videos = req.files.videos.map(f => f.path);
    const audios = req.files.audios.map(f => f.path);

    const output = "output.mp4";

    // Create video list
    fs.writeFileSync(
      "videos.txt",
      videos.map(v => `file '${v}'`).join("\n")
    );

    // Merge videos
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input("videos.txt")
        .inputOptions(["-f concat", "-safe 0"])
        .output("merged_video.mp4")
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    // Mix audios
    await new Promise((resolve, reject) => {
      const cmd = ffmpeg();
      audios.forEach(a => cmd.input(a));

      cmd
        .complexFilter([`amix=inputs=${audios.length}`])
        .output("mixed_audio.mp3")
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    // Merge video + audio
    ffmpeg("merged_video.mp4")
      .input("mixed_audio.mp3")
      .outputOptions(["-c:v copy"])
      .save(output)
      .on("end", () => res.download(output));
  }
);

app.listen(3000, () => console.log("Server running"));
