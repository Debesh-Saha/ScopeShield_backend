import express from "express";
import router from "./routes";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

const app= express();
dotenv.config();

app.use(express.json());
app.use(cors());
app.use("/api/v1", router);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: "Route not found."
    });
});

app.listen(process.env.PORT || 3000);
