import mongoose, { model, Schema } from "mongoose";
import dotenv from "dotenv";
dotenv.config();
mongoose.connect(process.env.MONGO_URL!);

const ProjectSchema = new mongoose.Schema(
    {
        owner: {type: mongoose.Schema.Types.ObjectId, ref: "User",required: true},
        projectName: { type: String, required: true, trim: true },
        clientName: { type: String, required: true, trim: true },
        hourlyRate: { type: Number, required: true, min: 0 },
        currency: { type: String, enum: ["INR", "USD", "EUR", "GBP"], default: "INR" },
        scopeDocuments: [{ fileName: String, filePath: String, originalName: String, mimeType: String, uploadedAt: { type: Date, default: Date.now } }],
        status: { type: String, enum: ["ACTIVE", "COMPLETED", "ARCHIVED"], default: "ACTIVE" },
    },
    {
        timestamps: true,
    }
);

const ScopeItemSchema = new mongoose.Schema(
    {
        analysisId: { type: mongoose.Schema.Types.ObjectId, ref: "Analysis", required: true },
        featureName: { type: String, required: true, trim: true },
        clientQuote: { type: String, required: true },
        reasoning: { type: String, required: true },
        estimatedHours: { type: Number, required: true, min: 0 },
        finalEstimatedHours: { type: Number, required: true, min: 0 },
        status: { type: String, enum: ["REVIEW_PENDING", "APPROVED", "DISMISSED"], default: "REVIEW_PENDING" },
        isOutOfScope: { type: Boolean, required: true, default: false },
    },
    {
        timestamps: true,
    }
)

const AnalysisSchema = new mongoose.Schema(
    {
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
        chatFiles: [{ fileName: String, filePath: String, originalName: String, mimeType: String, uploadedAt: { type: Date, default: Date.now } }],
        totalHours: { type: Number, default: 0 },
        status: { type: String, enum: ["PENDING", "COMPLETED", "FAILED"], default: "PENDING" },
        pdf: { fileName: String, filePath: String, generatedAt: Date, version: { type: Number, default: 1 } }
    },
    {
        timestamps: true
    }
)

const UserSchema = new Schema({
    username: { type: String },
    email: { type: String, unique: true, sparse: true },
    password: { type: String, required: false },
    googleId: { type: String, unique: true, sparse: true }
});

export const ProjectModel = model("Project", ProjectSchema);
export const ScopeItemModel = model("ScopeItem", ScopeItemSchema);
export const AnalysisModel = model("Analysis", AnalysisSchema);
export const UserModel = model("User", UserSchema);